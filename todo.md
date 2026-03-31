## Tasks

### Docs

### Navigation
- [ ] Vyasa home page could be just a list of recent posts if configured that way
- [ ] Vyasa home page should be customizable. Currently it is either index.md or readme.md. Ideally this should be mentionable in the .vyasa file as "home: index.md" or "home: readme.md" or "home: X.md" where X is the name of the file that should be used as the home page. If not specified, it should default to index.md first, and then to readme.md if they exist.
- [x] Add "next post" and "previous post" links at the bottom of each
- [x] Facilitate folder notes - special handling for folder notes, i.e., index.md/readme.md/X.md where X is the same name as the name of the files' parent folder
- [x] Control the order of posts (by date, by title, manually) in .vyasa file

- [ ] Find One Piece | author: Monkey D. Luffy | deadline: None
- [ ] Become the world's greatest swordsman | author: Zoro | deadline: None
- [ ] Map the entire world | author: Nami | deadline: None

### Supported Task Metadata
- [ ] Person icon aliases | owner: owner, author, assignee, person, user, who
- [ ] Calendar icon aliases | deadline: deadline, due, date, when, eta
- [ ] Priority icon aliases | priority: priority, urgency, severity, importance
- [ ] Status icon aliases | status: status, state, phase
- [ ] Project icon aliases | project: project, bucket, area, team, stream

### Combined Example Task
- [ ] Write a blog post about Vyasa | author: John Doe | deadline: 2024-12-31 | priority: high | status: in progress | project: Vyasa Blog
- [x] Plan a trip to Japan | owner: Jane Smith | due: 2024-10-01 | urgency: medium | state: not started | bucket: Personal Travel