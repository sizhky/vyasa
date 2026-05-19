# Folder Ordering

Folder-local `.vyasa` controls local navigation order.
Use exact filenames when pinning items.
Use folder-local sorting for the sidebar/tree.

A folder-local `.vyasa` is also a lazy posts tree branch marker.
Even if a folder has no direct markdown files and only nested subfolders, it should appear so the branch can lazy-load.

`layout_max_width`, abbreviations, `ignore`, and `include` can also apply at folder level when supported.
Avoid mixing root app concerns with folder ordering concerns.
