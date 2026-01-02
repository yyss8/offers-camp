// Reserved usernames that cannot be registered
const RESERVED_USERNAMES = [
    // ===== System Admin =====
    'admin', 'administrator', 'admins',
    'root', 'superuser', 'superadmin',
    'system', 'sysadmin', 'systemadmin',
    'owner', 'master', 'webmaster',

    // ===== Team Roles =====
    'moderator', 'mod', 'mods',
    'support',
    'staff', 'employee', 'service',
    'manager', 'supervisor',

    // ===== Function Pages =====
    'login', 'signin', 'signup', 'register', 'registration',
    'logout', 'signout',

    // ===== API/Technical =====
    'api', 'apis',
    'developer', 'dev', 'developers',
    'test',
    'staging', 'production', 'prod',

    // ===== Network Protocol =====
    'www', 'ftp', 'smtp', 'pop', 'imap',
    'mail', 'email', 'webmail',
    'http', 'https', 'ssl', 'cdn',
    'dns', 'domain', 'subdomain',
    'localhost', 'server', 'host',

    // ===== Generic Placeholders =====
    'user', 'users', 'username',
    'guest', 'visitor', 'anonymous', 'anon',
    'default', 'example', 'sample',
    'placeholder',
    'null', 'undefined', 'none', 'unknown',

    // ===== Database/SQL Keywords =====
    'select', 'insert', 'update', 'delete', 'drop',
    'create', 'alter', 'table', 'database',
    'password',

    // ===== Brand Specific =====
    'offers', 'offerscamp', 'offers-camp', 'offers_camp',
];

// Username validation rules
const USERNAME_RULES = {
    minLength: 4,
    maxLength: 20,

    // Regex patterns
    patterns: {
        // Only allow letters, numbers, underscore, hyphen
        allowed: /^[a-zA-Z0-9_-]+$/,

        // Cannot start or end with special characters
        noSpecialStartEnd: /^[a-zA-Z0-9].*[a-zA-Z0-9]$/,

        // Cannot have consecutive special characters
        noConsecutiveSpecial: /^(?!.*[_-]{2,}).*$/,

        // Cannot be only numbers
        notOnlyNumbers: /^(?!\d+$).*$/,

        // Cannot contain admin, mod, root variants (case insensitive)
        noAdminVariants: /^(?!.*admin)(?!.*moderator)(?!.*root).*$/i,
    },
};

/**
 * Validates a username against reserved names and format rules
 * @param {string} username - The username to validate
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
export function validateUsername(username) {
    // Convert to lowercase for checking
    const lower = username.toLowerCase();

    // 1. Check length
    if (username.length < USERNAME_RULES.minLength || username.length > USERNAME_RULES.maxLength) {
        return {
            valid: false,
            reason: `Username must be ${USERNAME_RULES.minLength}-${USERNAME_RULES.maxLength} characters`,
        };
    }

    // 2. Check if in reserved list
    if (RESERVED_USERNAMES.includes(lower)) {
        return { valid: false, reason: 'This username is reserved' };
    }

    // 3. Check if contains reserved words
    for (const reserved of RESERVED_USERNAMES) {
        if (lower.includes(reserved)) {
            return { valid: false, reason: 'Username contains reserved words' };
        }
    }

    // 4. Check format rules
    if (!USERNAME_RULES.patterns.allowed.test(username)) {
        return {
            valid: false,
            reason: 'Only letters, numbers, underscore and hyphen allowed',
        };
    }

    if (!USERNAME_RULES.patterns.noSpecialStartEnd.test(username)) {
        return {
            valid: false,
            reason: 'Username cannot start or end with special characters',
        };
    }

    if (!USERNAME_RULES.patterns.noConsecutiveSpecial.test(username)) {
        return {
            valid: false,
            reason: 'Username cannot contain consecutive special characters',
        };
    }

    if (!USERNAME_RULES.patterns.notOnlyNumbers.test(username)) {
        return { valid: false, reason: 'Username cannot be only numbers' };
    }

    // 5. Check if appears to impersonate official account
    const officialPatterns = [
        /^offers.*official$/i,
        /^official.*offers$/i,
        /^offers.*admin$/i,
        /^offers.*team$/i,
        /^offers.*staff$/i,
    ];

    for (const pattern of officialPatterns) {
        if (pattern.test(username)) {
            return {
                valid: false,
                reason: 'Username appears to impersonate official account',
            };
        }
    }

    return { valid: true };
}
