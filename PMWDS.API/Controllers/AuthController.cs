using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Users;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Infrastructure.Settings;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Net;

namespace PMWDS.API.Controllers;

public class AuthController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly JwtSettings _jwt;
    private readonly EmailSettings _email;
    private readonly IEmailService _emailService;
    private readonly ILoginLockoutService _loginLockout;

    public AuthController(
        IMediator mediator,
        IUnitOfWork uow,
        IOptions<JwtSettings> jwt,
        IOptions<EmailSettings> email,
        IEmailService emailService,
        ILoginLockoutService loginLockout) : base(mediator)
    {
        _uow = uow;
        _jwt = jwt.Value;
        _email = email.Value;
        _emailService = emailService;
        _loginLockout = loginLockout;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest req,
        CancellationToken ct)
    {
        // Check if account is temporarily locked out due to too many failed attempts
        if (await _loginLockout.IsLockedOutAsync(req.Email))
        {
            return StatusCode(429, new
            {
                Message = "Account temporarily locked due to too many failed login attempts. Try again later.",
                LockedOut = true
            });
        }

        var user = await _uow.Users.GetByEmailAsync(req.Email, ct);
        var passwordVerification = user == null
            ? PasswordVerificationResult.Failed
            : VerifyPassword(user, req.Password);
        if (user == null || passwordVerification == PasswordVerificationResult.Failed)
        {
            await _loginLockout.RecordFailureAsync(req.Email);
            return Unauthorized(new { Message = "Invalid credentials." });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new { Message = "Your account has been deactivated. Please contact your administrator." });
        }

        // Clear failed login attempts on successful authentication
        await _loginLockout.ResetAsync(req.Email);

        var roles = UserRoleResolver.ResolveNames(user);
        var roleKeys = UserRoleResolver.ResolveKeys(user);
        var permissions = ResolvePermissions(user);
        if (passwordVerification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.SetPassword(HashPassword(user, req.Password));
            await _uow.SaveChangesAsync(ct);
        }

        var (refreshToken, refreshTokenExpiresAt) = IssueRefreshToken(user);
        var token = GenerateToken(user, roleKeys, permissions);

        var log = ActivityLog.Create(
            user.Id,
            "Login",
            $"{user.FullName} logged in",
            new Dictionary<string, object>());
        log.SetCreatedBy(user.Id.ToString());
        await _uow.ActivityLogs.AddAsync(log, ct);
        await _uow.SaveChangesAsync(ct);

        return Ok(new
        {
            Token = token,
            Expiry = DateTime.UtcNow.AddMinutes(_jwt.ExpiryMinutes),
            RefreshToken = refreshToken,
            RefreshTokenExpiry = refreshTokenExpiresAt,
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            ProfilePictureUrl = user.ProfilePictureUrl,
            Roles = roles,
            RoleKeys = roleKeys,
            Permissions = permissions
        });
    }

    [AllowAnonymous]
    [HttpPost("signup")]
    public async Task<IActionResult> Signup([FromBody] SignupRequest req, CancellationToken ct)
    {
        string? pwdError = null;
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password) || !IsPasswordValid(req.Password, out pwdError))
        {
            return BadRequest(new { message = pwdError ?? "Email and a valid password are required." });
        }

        var email = req.Email.ToLower().Trim();
        if ((await _uow.Users.FindAsync(u => u.Email == email, ct)).Any())
        {
            return Conflict(new { message = $"A user with email '{email}' already exists." });
        }

        var viewer = (await _uow.Roles.FindAsync(r => r.Key == RoleKeys.Viewer || r.Name == "Viewer", ct)).FirstOrDefault();
        if (viewer == null)
        {
            return BadRequest(new { message = "Viewer role was not found." });
        }

        var user = ApplicationUser.Create(
            email,
            req.FirstName,
            req.LastName,
            Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            req.JobTitle ?? "Viewer");
        user.SetCreatedBy("signup");
        user.Roles.Add(viewer);
        user.SetPassword(HashPassword(user, req.Password));

        await _uow.Users.AddAsync(user, ct);
        await _uow.SaveChangesAsync(ct);

        var log = ActivityLog.Create(
            user.Id,
            "Signup",
            $"{user.FullName} signed up",
            new Dictionary<string, object>
            {
                ["newUserId"] = user.Id,
                ["newUserEmail"] = user.Email
            });
        log.SetCreatedBy(user.Id.ToString());
        await _uow.ActivityLogs.AddAsync(log, ct);
        await _uow.SaveChangesAsync(ct);

        return Ok(UserDto.FromEntity(user, new List<string> { "Viewer" }));
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        var email = req.Email.ToLower().Trim();
        var user = await _uow.Users.GetByEmailAsync(email, ct);
        if (user is { IsActive: true })
        {
            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            var token = WebEncoders.Base64UrlEncode(tokenBytes);
            var tokenHash = HashToken(token);
            var expires = DateTime.UtcNow.AddMinutes(Math.Max(_email.PasswordResetMinutes, 5));
            user.SetPasswordResetToken(tokenHash, expires);
            await _uow.SaveChangesAsync(ct);

            var resetUrl = $"{_email.ClientBaseUrl.TrimEnd('/')}/reset-password?email={WebUtility.UrlEncode(email)}&token={WebUtility.UrlEncode(token)}";
            await _emailService.SendEmailAsync(email, "Reset your PMWDS password", BuildPasswordResetEmail(user.FullName, resetUrl, expires), ct);
        }

        return Ok(new { message = "If the email exists, a password reset link has been sent." });
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        string? resetPwdError = null;
        if (string.IsNullOrWhiteSpace(req.NewPassword) || !IsPasswordValid(req.NewPassword, out resetPwdError))
        {
            return BadRequest(new { message = resetPwdError ?? "New password must meet the complexity requirements." });
        }

        var user = await _uow.Users.GetByEmailAsync(req.Email.ToLower().Trim(), ct);
        if (user == null || !user.IsPasswordResetTokenValid(HashToken(req.Token)))
        {
            return BadRequest(new { message = "Password reset link is invalid or expired." });
        }

        user.SetPassword(HashPassword(user, req.NewPassword));
        await _uow.SaveChangesAsync(ct);
        return Ok(new { message = "Password reset successfully." });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest req,
        CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return Unauthorized();
        }

        var user = await _uow.Users.GetByIdAsync(parsedUserId, ct);
        if (user == null)
        {
            return NotFound();
        }

        var passwordVerification = VerifyPassword(user, req.OldPassword);
        if (passwordVerification == PasswordVerificationResult.Failed)
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        string? changePwdError = null;
        if (string.IsNullOrWhiteSpace(req.NewPassword) || !IsPasswordValid(req.NewPassword, out changePwdError))
        {
            return BadRequest(new { message = changePwdError ?? "New password must meet the complexity requirements." });
        }

        var newHash = HashPassword(user, req.NewPassword);
        user.SetPassword(newHash);

        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Password Changed",
            Description: $"{user.FullName} changed their password",
            Metadata: new Dictionary<string, object>
            {
                ["userId"] = user.Id
            }
        );

        return Ok(new { message = "Password changed successfully." });
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.UserId, out var parsedUserId) || string.IsNullOrWhiteSpace(req.RefreshToken))
        {
            return Unauthorized();
        }

        var user = await _uow.Users.GetByIdAsync(parsedUserId, ct);
        if (user == null || !user.IsRefreshTokenValid(HashToken(req.RefreshToken)))
        {
            return Unauthorized();
        }

        var (refreshToken, refreshTokenExpiresAt) = IssueRefreshToken(user);
        await _uow.SaveChangesAsync(ct);

        var token = GenerateToken(user, UserRoleResolver.ResolveKeys(user), ResolvePermissions(user));
        return Ok(new
        {
            Token = token,
            Expiry = DateTime.UtcNow.AddMinutes(_jwt.ExpiryMinutes),
            RefreshToken = refreshToken,
            RefreshTokenExpiry = refreshTokenExpiresAt
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(userId, out var parsedUserId))
        {
            var user = await _uow.Users.GetByIdAsync(parsedUserId, ct);
            if (user != null)
            {
                user.RevokeAllTokens();
                await _uow.SaveChangesAsync(ct);
            }
        }

        return NoContent();
    }

    private static PasswordVerificationResult VerifyPassword(ApplicationUser user, string password)
    {
        var normalized = password?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(normalized))
        {
            return PasswordVerificationResult.Failed;
        }

        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            var hasher = new PasswordHasher<ApplicationUser>();
            return hasher.VerifyHashedPassword(user, user.PasswordHash, normalized);
        }

        return PasswordVerificationResult.Failed;
    }

    private string GenerateToken(
        ApplicationUser user,
        IEnumerable<string> roleKeys,
        IEnumerable<string> permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new("DepartmentId", user.DepartmentId?.ToString() ?? string.Empty),
            new("token_version", user.AccessTokenVersion.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(roleKeys.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(roleKeys.Select(r => new Claim(RoleKeys.RoleClaimType, r)));
        claims.AddRange(permissions.Select(p => new Claim(PermissionCodes.PermissionClaimType, p)));

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_jwt.Secret ?? string.Empty));
        var creds = new SigningCredentials(
            key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwt.ExpiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static List<string> ResolvePermissions(ApplicationUser user)
    {
        var codes = user.Roles
            .SelectMany(role => role.Permissions)
            .Select(permission => permission.Code)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Keep legacy permission claims for existing clients/tests while the persisted
        // matrix uses explicit OWN/ALL permissions. These aliases are compatibility-only
        // and are not shown in the role editor.
        foreach (var code in codes.ToArray())
        {
            var match = System.Text.RegularExpressions.Regex.Match(
                code,
                @"^(DEPARTMENT|PROJECT|MILESTONE|TASK|SUBTASK|USER|NOTIFICATION|REPORT|ACTIVITY_LOG|DOCUMENT|UTILIZATION_CERTIFICATE|KNOWLEDGE)_(OWN|ALL)_(VIEW|CREATE|EDIT|DELETE|MANAGE|REVIEW|ASSIGN|COMMENT_CREATE|ATTACHMENT_CREATE)$",
                System.Text.RegularExpressions.RegexOptions.CultureInvariant);

            if (match.Success)
            {
                codes.Add($"{match.Groups[1].Value}_{match.Groups[3].Value}");
            }

            if (codes.Contains(PermissionCodes.SystemAdmin))
            {
                break;
            }
        }

        return codes.OrderBy(code => code).ToList();
    }

    private static string HashPassword(ApplicationUser user, string password)
        => new PasswordHasher<ApplicationUser>().HashPassword(user, password.Trim());

    private (string Token, DateTime ExpiresAtUtc) IssueRefreshToken(ApplicationUser user)
    {
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(64));
        var expiresAt = DateTime.UtcNow.AddDays(Math.Max(_jwt.RefreshTokenDays, 1));
        user.SetRefreshToken(HashToken(token), expiresAt);
        return (token, expiresAt);
    }

    /// <summary>
    /// Validates password meets complexity requirements:
    /// minimum 10 characters, at least one uppercase, one lowercase, one digit, one special character.
    /// </summary>
    private static bool IsPasswordValid(string password, out string? error)
    {
        if (password.Length < 10)
        {
            error = "Password must be at least 10 characters long.";
            return false;
        }
        if (!password.Any(char.IsUpper))
        {
            error = "Password must contain at least one uppercase letter.";
            return false;
        }
        if (!password.Any(char.IsLower))
        {
            error = "Password must contain at least one lowercase letter.";
            return false;
        }
        if (!password.Any(char.IsDigit))
        {
            error = "Password must contain at least one digit.";
            return false;
        }
        if (!password.Any(c => !char.IsLetterOrDigit(c)))
        {
            error = "Password must contain at least one special character.";
            return false;
        }
        error = null;
        return true;
    }

    private static string HashToken(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));

    private static string BuildPasswordResetEmail(string fullName, string resetUrl, DateTime expiresAtUtc)
        => $$"""
        <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.5;color:#1f2937">
          <h2 style="margin:0 0 12px">Reset your PMWDS password</h2>
          <p>Hello {{WebUtility.HtmlEncode(fullName)}},</p>
          <p>Use the link below to set a new password. This link expires at {{expiresAtUtc:yyyy-MM-dd HH:mm}} UTC.</p>
          <p><a href="{{WebUtility.HtmlEncode(resetUrl)}}" style="display:inline-block;background:#4f46e5;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
          <p style="font-size:12px;color:#64748b">If you did not request this, you can ignore this email.</p>
        </div>
        """;
}
