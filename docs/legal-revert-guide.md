# Legal Revert Guide

This repo currently uses placeholder legal pages. The original content is preserved in JSX comments inside each file.

## Files with placeholders

- `app/legal/agb/page.tsx`
- `app/legal/datenschutz/page.tsx`
- `app/legal/impressum/page.tsx`
- `app/legal/widerruf/page.tsx`

## Comment marker

Search for this marker inside each file:

`ORIGINAL LEGAL TEXT (commented for later restore)`

The original legal content sits directly below that marker and is wrapped in a JSX block comment.

## Restore steps

1. Open the file and remove the placeholder banner, placeholder sections, and placeholder footer at the top of the page.
2. Un-comment the original content by removing the surrounding `{/*` and `*/}`.
3. Remove the placeholder styles by deleting the rules for `.legal-placeholder-banner` and `.legal-placeholder-banner strong`.
4. Review and update any dates, names, and addresses in the restored legal text.
