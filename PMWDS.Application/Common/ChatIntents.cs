namespace PMWDS.Application.Common;

/// <summary>
/// Intents the chat assistant recognises, and the rules that pick between them.
///
/// This lives in Application because both the API layer (which decides what data to
/// fetch) and the AI layer (which decides how to phrase the answer) need it, and
/// neither should depend on the other.
/// </summary>
public static class ChatIntents
{
    public const string ProjectList = "ProjectList";
    public const string ProjectStatus = "ProjectStatus";
    public const string DelayAnalysis = "DelayAnalysis";
    public const string TaskAssignment = "TaskAssignment";
    public const string TaskQuery = "TaskQuery";
    public const string MilestoneQuery = "MilestoneQuery";
    public const string DocumentQuery = "DocumentQuery";
    public const string BudgetQuery = "BudgetQuery";
    public const string ResourceManagement = "ResourceManagement";
    public const string Reporting = "Reporting";
    public const string General = "General";

    /// <summary>
    /// Every intent, in the order the suggested-actions list should consider them.
    /// </summary>
    public static readonly IReadOnlyList<string> All =
    [
        ProjectList,
        ProjectStatus,
        DelayAnalysis,
        TaskAssignment,
        TaskQuery,
        MilestoneQuery,
        DocumentQuery,
        BudgetQuery,
        ResourceManagement,
        Reporting,
        General
    ];

    /// <summary>
    /// Picks the intent for a message.
    ///
    /// Order matters and is deliberate: the first matching rule wins. More specific
    /// subjects are tested before broader ones, because "which project is delayed"
    /// is a DelayAnalysis question even though it mentions a project, while "what
    /// is the status of everything" is a ProjectStatus question.
    ///
    /// Matching is done on word boundaries rather than substrings. Plain
    /// <c>Contains</c> was the original bug in two ways: "status" matched inside
    /// "estimate", and nothing at all matched "tell me about all the projects",
    /// which fell through to General and therefore shipped the model no data. The
    /// model then correctly reported it had no access to any project data.
    /// </summary>
    public static string Detect(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return General;
        }

        var text = message.ToLowerInvariant();

        // "assign" only matches as a whole word, so "assigned to me" lands on
        // TaskQuery rather than being read as a request to assign someone.
        if (HasAny(text, "assign", "reassign", "who should", "who can take", "allocate",
            "pick someone", "best person for", "hand this to"))
        {
            return TaskAssignment;
        }

        // Checked before the resource rules because "utilization" is a people
        // word, but a "utilization certificate" is a document. Both numbers are
        // listed because the matcher is whole-word and would otherwise miss the
        // plural.
        if (Mentions(text, "utilization certificate", "utilization certificates",
            "utilisation certificate", "utilisation certificates"))
        {
            return DocumentQuery;
        }

        // Ahead of the risk rules on purpose: "check burnout risk" and "who is
        // overloaded" are questions about people. The word "risk" in them belongs
        // to burnout, not to schedule slippage.
        if (HasAny(text, "workload", "capacity", "resource", "overload", "overloaded",
            "overloading", "burnout", "bandwidth", "utilization", "utilisation",
            "who is free", "who has capacity"))
        {
            return ResourceManagement;
        }

        if (MentionsRisk(text))
        {
            return DelayAnalysis;
        }

        if (Mentions(text, "budget", "cost", "spend", "spent", "expenditure", "financial",
            "money", "variance"))
        {
            return BudgetQuery;
        }

        if (Mentions(text, "document", "documents", "file", "files", "attachment",
            "attachments", "contract", "contracts", "certificate", "certificates"))
        {
            return DocumentQuery;
        }

        if (Mentions(text, "milestone", "milestones", "deadline", "deadlines",
            "timeline", "schedule"))
        {
            return MilestoneQuery;
        }

        if (HasAny(text, "report", "analytics", "dashboard", "metrics"))
        {
            return Reporting;
        }

        // Enumeration questions ("tell me about all the projects", "list tasks")
        // reach here as a request for a catalogue. A status word still wins,
        // because "which projects have a health score" is a health question and
        // the dossier it needs is different.
        if (IsEnumeration(text))
        {
            if (MentionsStatus(text))
            {
                return ProjectStatus;
            }

            var subject = DetectSubject(text);
            if (subject != null)
            {
                return subject;
            }
        }

        if (Mentions(text, "project", "projects", "portfolio"))
        {
            return MentionsStatus(text) ? ProjectStatus : ProjectList;
        }

        if (Mentions(text, "task", "tasks", "subtask", "subtasks", "todo", "to-do",
            "assigned", "assignment", "backlog"))
        {
            return TaskQuery;
        }

        return General;
    }

    /// <summary>
    /// Words that mean "give me the catalogue" rather than "analyse it".
    /// </summary>
    private static bool IsEnumeration(string text)
        => HasAny(text, "all", "list", "every", "each", "what are", "what is",
            "show me", "tell me", "overview", "summary of", "give me", "which");

    private static bool MentionsStatus(string text)
        => HasAny(text, "status", "progress", "health", "health score", "going",
            "on track", "how are", "update", "how is it going");

    /// <summary>
    /// Which catalogue is being asked for, or null if the message does not name
    /// one.
    /// </summary>
    private static string? DetectSubject(string text)
    {
        if (Mentions(text, "project", "projects", "portfolio"))
        {
            return ProjectList;
        }

        if (Mentions(text, "task", "tasks", "subtask", "subtasks", "todo", "to-do", "backlog"))
        {
            return TaskQuery;
        }

        if (Mentions(text, "milestone", "milestones"))
        {
            return MilestoneQuery;
        }

        if (Mentions(text, "document", "documents", "file", "files", "attachment",
            "attachments", "contract", "contracts"))
        {
            return DocumentQuery;
        }

        return null;
    }

    /// <summary>
    /// Actions offered under the answer. These are labels the client renders as
    /// chips, so they stay short and imperative.
    /// </summary>
    public static List<string> SuggestedActions(string intent)
        => intent switch
        {
            ProjectList => ["Open Projects", "Compare Health Scores", "Show Budget Summary"],
            ProjectStatus => ["View Dashboard", "Generate Status Report", "View Milestones"],
            DelayAnalysis => ["View Overdue Tasks", "Escalate Now", "Adjust Timeline"],
            TaskAssignment => ["View AI Recommendations", "Assign Task Now", "Check Team Availability"],
            TaskQuery => ["View My Tasks", "Show Overdue Only", "Filter by Project"],
            MilestoneQuery => ["View Milestones", "Show Critical Path", "Check Upcoming Deadlines"],
            DocumentQuery => ["Browse Documents", "Show Recent Uploads", "Check Contracts"],
            BudgetQuery => ["View Financials", "Show Budget Variance", "Compare Projects"],
            ResourceManagement => ["View Workload Distribution", "Optimize Allocation", "Check Burnout Risk"],
            Reporting => ["Generate Report", "View Dashboard", "Export to PDF"],
            _ => ["Open Projects", "View My Tasks", "Check At-Risk Work"]
        };

    /// <summary>
    /// The assistant only ever reads data, so no intent requires a confirmation
    /// step. Kept as a hook so the client contract does not change if a writing
    /// intent is ever added.
    /// </summary>
    public static bool NeedsConfirmation(string intent) => false;

    private static bool Mentions(string text, params string[] words)
        => words.Any(word => HasWord(text, word));

    private static bool HasAny(string text, params string[] words)
        => words.Any(word => HasWord(text, word));

    private static bool MentionsRisk(string text)
        => HasAny(text,
            "delay", "delayed", "delay risk", "at risk", "at-risk", "overdue", "late",
            "behind", "slipping", "slipped", "blocked", "blocker", "escalat", "stuck",
            "off track", "off-track", "risk");

    /// <summary>
    /// True when <paramref name="word"/> appears as a whole word.
    ///
    /// A simple substring test is not good enough here: "status" is inside
    /// "estimate", "risk" is inside "brisk", and "cost" is inside "customer".
    /// Any of those would file the question under the wrong intent and fetch the
    /// wrong slice of data.
    /// </summary>
    private static bool HasWord(string text, string word)
    {
        var index = text.IndexOf(word, StringComparison.Ordinal);
        while (index >= 0)
        {
            if (IsWholeWord(text, index, word.Length))
            {
                return true;
            }

            index = text.IndexOf(word, index + 1, StringComparison.Ordinal);
        }

        return false;
    }

    private static bool IsWholeWord(string text, int start, int length)
    {
        if (start > 0 && IsWordChar(text[start - 1]))
        {
            return false;
        }

        var end = start + length;
        return end >= text.Length || !IsWordChar(text[end]);
    }

    private static bool IsWordChar(char c) => char.IsLetterOrDigit(c) || c == '_';
}
