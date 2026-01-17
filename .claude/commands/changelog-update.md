---
description: Update CHANGELOG.md with current changes
---

# Update Changelog

Update CHANGELOG.md with recent changes using this workflow:

1. Check git status and recent commits on current branch to understand what changed
2. Read package.json to get current version
3. Read existing CHANGELOG.md to understand the format
4. Add new entry at the top with:
   - Version from package.json
   - Today's date (December 18, 2024)
   - User-facing descriptions of changes

## Important Guidelines

- Write for USERS, not developers
- Focus on what changed from user perspective (features, fixes, improvements)
- Avoid technical jargon and implementation details
- Group changes by type: Added, Changed, Fixed, Removed
- Use clear, concise language
- Keep format consistent with existing entries

## Example Entry Format

```
## [1.2.3] - 2024-12-18

### Added
- New feature description from user perspective

### Changed
- What improved or changed for users

### Fixed
- What bugs were resolved
```

Analyze the changes and write user-friendly descriptions.
