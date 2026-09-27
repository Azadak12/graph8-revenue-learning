import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    REV_LEADER = "rev_leader"
    MANAGER = "manager"
    REP = "rep"
    READ_ONLY = "read_only"


class ConnectionMode(str, enum.Enum):
    DEMO = "demo"
    LIVE = "live"


class ConnectionStatus(str, enum.Enum):
    NOT_CONFIGURED = "not_configured"
    CONNECTED = "connected"
    ERROR = "error"


class WebhookProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class DealOutcome(str, enum.Enum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"


class DealSegment(str, enum.Enum):
    ENTERPRISE = "enterprise"
    MID_MARKET = "mid_market"
    SMB = "smb"


class ContactRole(str, enum.Enum):
    CHAMPION = "champion"
    DECISION_MAKER = "decision_maker"
    INFLUENCER = "influencer"
    BLOCKER = "blocker"
    COACH = "coach"
    END_USER = "end_user"
    UNKNOWN = "unknown"


class EvidenceSourceType(str, enum.Enum):
    MEETING = "meeting"
    TRANSCRIPT = "transcript"
    DEAL_ACTIVITY = "deal_activity"
    NOTE = "note"
    CLOSE_REASON = "close_reason"
    STAKEHOLDER_DATA = "stakeholder_data"
    SALESPERSON_CONFIRMATION = "salesperson_confirmation"
    OTHER = "other"


class EvidenceStrength(str, enum.Enum):
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"


class ConfidenceLevel(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    NEEDS_CLARIFICATION = "needs_clarification"
    FAILED = "failed"


class FactorCategory(str, enum.Enum):
    PRODUCT_CAPABILITY_GAP = "product_capability_gap"
    INTEGRATION_GAP = "integration_gap"
    PRICING = "pricing"
    PACKAGING = "packaging"
    COMPETITOR = "competitor"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    PRIVACY = "privacy"
    LEGAL = "legal"
    IMPLEMENTATION = "implementation"
    SUPPORT = "support"
    WRONG_FIT = "wrong_fit"
    MISSING_DECISION_MAKER = "missing_decision_maker"
    WEAK_CHAMPION = "weak_champion"
    STAKEHOLDER_MISALIGNMENT = "stakeholder_misalignment"
    POOR_DISCOVERY = "poor_discovery"
    POOR_DEMO = "poor_demo"
    SLOW_FOLLOWUP = "slow_followup"
    PROPOSAL_DELAY = "proposal_delay"
    COMMUNICATION = "communication"
    VALUE_NOT_PROVEN = "value_not_proven"
    ROI_NOT_PROVEN = "roi_not_proven"
    TIMING = "timing"
    BUDGET = "budget"
    PRIORITY_CHANGE = "priority_change"
    BUYER_PROJECT_CANCELLED = "buyer_project_cancelled"
    PROCUREMENT = "procurement"
    INTERNAL_SELLER_DELAY = "internal_seller_delay"
    UNKNOWN = "unknown"
    OTHER = "other"


class FactorType(str, enum.Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"


class Preventability(str, enum.Enum):
    PREVENTABLE = "preventable"
    POTENTIALLY_PREVENTABLE = "potentially_preventable"
    NOT_PREVENTABLE = "not_preventable"
    UNKNOWN = "unknown"


class Department(str, enum.Enum):
    SALES = "sales"
    SALES_ENGINEERING = "sales_engineering"
    PRODUCT = "product"
    ENGINEERING = "engineering"
    PRICING = "pricing"
    FINANCE = "finance"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    PRIVACY = "privacy"
    LEGAL = "legal"
    OPERATIONS = "operations"
    IMPLEMENTATION = "implementation"
    LEADERSHIP = "leadership"


class FeedbackType(str, enum.Enum):
    CLARIFICATION = "clarification"
    CORRECTION = "correction"


class PatternStrength(str, enum.Enum):
    ONE_OFF = "one_off"
    EMERGING_PATTERN = "emerging_pattern"
    RECURRING_PATTERN = "recurring_pattern"
    STRONG_PATTERN = "strong_pattern"


class PatternStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"


class RecommendationPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecommendationStatus(str, enum.Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    ACTIONED = "actioned"
    DISMISSED = "dismissed"


class ActionType(str, enum.Enum):
    CREATE_TASK = "create_task"
    CREATE_NOTE = "create_note"


class ActionStatus(str, enum.Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    CREATED = "created"
    FAILED = "failed"


class WarningStatus(str, enum.Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    TASK_CREATED = "task_created"
    DISMISSED = "dismissed"
