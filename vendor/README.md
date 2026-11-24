# Vendored Third-Party Scripts

These files are downloaded verbatim and never edited.

| File | Library | Version | Source URL | SHA-384 | License |
|------|---------|---------|------------|---------|---------|
| `tailwindcss-play-3.4.17.js` | Tailwind CSS Play CDN | 3.4.17 | `https://cdn.tailwindcss.com/3.4.17` | `sha384-igm5BeiBt36UU4gqwWS7imYmelpTsZlQ45FZf+XBn9MuJbn4nQr7yx1yFydocC/K` | MIT |
| `lucide-1.79.0.min.js` | Lucide (UMD) | 1.79.0 | `https://unpkg.com/lucide@1.79.0/dist/umd/lucide.min.js` (verified identical to `https://cdn.jsdelivr.net/npm/lucide@1.79.0/dist/umd/lucide.min.js`) | `sha384-BqRrWtT4teonPDtZKRNshL/rppOoqxeAHLfUcL1tSbU0Slok4OE/xVxwdLb9R2ls` | ISC |

## Upgrading a vendored script

1. Download the new pinned version from two independent sources where available (for example, unpkg and jsDelivr).
2. Compute and compare the `sha384` hash of both downloads to confirm they match byte-for-byte.
3. Save the file into `vendor/` with its version in the filename (never edit vendored files).
4. Update the table above and the `<script src>` paths in both HTML files in the same commit.
