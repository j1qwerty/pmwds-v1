namespace PMWDS.Domain.Time;

/// <summary>
/// The application's display timezone, and the only place "what time is it" is answered.
/// </summary>
/// <remarks>
/// <para>
/// Storage stays UTC. This type exists so that every "is this overdue / is this due today"
/// question is asked against the same day boundary the UI draws, instead of against whatever
/// the web server's local clock happens to say.
/// </para>
/// <para>
/// That mismatch is a real bug, not a theoretical one. Due dates are stored as
/// <c>DateTime</c> at midnight. Comparing a due date of <c>2026-07-01T00:00</c> against
/// <c>DateTime.UtcNow</c> marks the task overdue from 00:00 UTC, which is 05:30 IST - so a
/// task due *today* flashed red for the first five and a half hours of every morning, and a
/// server running in UTC quietly disagreed with every timestamp shown in the browser.
/// </para>
/// <para>
/// India observes no daylight saving, so the offset is a constant +05:30 and day boundaries
/// never move. Everything here is still expressed through <see cref="TimeZoneInfo"/> so a
/// future timezone is a one-line change.
/// </para>
/// </remarks>
public static class AppClock
{
    /// <summary>IANA identifier for the app timezone.</summary>
    public const string TimeZoneId = "Asia/Kolkata";

    /// <summary>Windows identifier for the same zone.</summary>
    private const string WindowsTimeZoneId = "India Standard Time";

    /// <summary>
    /// Fallback for a host with no timezone database: a fixed +05:30 offset. Correct for
    /// IST year round, which is why it is safe to fall back to rather than fail startup.
    /// </summary>
    private static readonly TimeSpan FallbackOffset = TimeSpan.FromMinutes(330);

    private static readonly TimeZoneInfo Zone = Resolve(TimeZoneId, WindowsTimeZoneId);

    /// <summary>Short label appended to rendered timestamps.</summary>
    public const string Label = "IST";

    public static TimeZoneInfo AppTimeZone => Zone;

    /// <summary>Current time in the app timezone. For display only - never persist this.</summary>
    public static DateTime AppNow =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone);

    /// <summary>Today in the app timezone.</summary>
    public static DateOnly AppToday => DateOnly.FromDateTime(AppNow);

    /// <summary>
    /// The last representable instant of today in the app timezone, as UTC.
    ///
    /// Use this as the "now" for any due-date comparison. A date-only value is due for the
    /// whole of its own day, so it must not be treated as overdue until the day is over.
    /// </summary>
    public static DateTime EndOfAppTodayUtc => EndOfDayUtc(AppToday);

    /// <summary>
    /// The end of the app-timezone day that contains <paramref name="calendarDate"/>, as UTC.
    /// </summary>
    public static DateTime EndOfDayUtc(DateOnly calendarDate)
        => EndOfDayUtc(calendarDate.ToDateTime(TimeOnly.MinValue));

    /// <inheritdoc cref="EndOfDayUtc(DateOnly)"/>
    public static DateTime EndOfDayUtc(DateTime calendarDate)
    {
        // The incoming value is a calendar date (typically midnight), so read its date part
        // rather than converting it - it carries no timezone of its own.
        var dayStart = calendarDate.Date;
        var dayEnd = dayStart.AddDays(1).AddTicks(-1);
        var unspecified = DateTime.SpecifyKind(dayEnd, DateTimeKind.Unspecified);
        var asUtc = TimeZoneInfo.ConvertTimeToUtc(unspecified, Zone);
        return DateTime.SpecifyKind(asUtc, DateTimeKind.Utc);
    }

    /// <summary>
    /// True when a due date (a date-only value) has passed in the app timezone.
    /// A task due today is not overdue until tomorrow.
    /// </summary>
    public static bool IsDueDatePassed(DateTime dueDate)
    {
        var due = DateOnly.FromDateTime(dueDate);
        return due < AppToday;
    }

    private static TimeZoneInfo Resolve(params string[] ids)
    {
        foreach (var id in ids)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (Exception ex) when (
                ex is TimeZoneNotFoundException
                or InvalidTimeZoneException
                or System.Security.SecurityException)
            {
                // Try the next identifier; the host may only know one of the two forms.
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone(
            TimeZoneId,
            FallbackOffset,
            TimeZoneId,
            TimeZoneId);
    }
}