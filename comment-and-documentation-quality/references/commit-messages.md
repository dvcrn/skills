## Commit Message Standards & Anti-Patterns

### Core Format
- **Subject:** Start with an imperative verb (Add, Fix, Update, Refactor, Remove). Capitalize first letter. No trailing period. Keep under 50 characters. No conventional commit prefixes (`feat:`, `fix:`).
- **Body:** Concise, high-information summary of the essential "why". Terse, technical, wrapped at 72 characters.

### Commit Anti-Patterns to Flag

#### 1. Narrative Essay & Request-Accounting Storytelling
- **Anti-Pattern:** Writing multi-paragraph essays dissecting step-by-step cold vs warm request counts or conversational storytelling.
- ❌
  ```text
  Cut the requests an item edit costs

  A named single-cell edit was four requests on a cold client. Passing poolId
  skips the lookup that finds the thing's pool, and verify: false drops the
  read-back, so the floor is now one request; a warm client pays two.

  The read-back stays on by default. Memrise drops writes silently under its
  account rate limit -- a 200 with the usual {"success": null} and the old
  value still in the row -- so there is no other way to know an edit landed.
  ```
- ✅
  ```text
  Optimize item edit request overhead

  Add poolId and verify options to bypass pool lookup and verification
  read-backs when updating items.
  ```

#### 2. Transient Test Lore & Debugging Diary Entries
- **Anti-Pattern:** Mentioning transient debugging artifacts, reverse-engineering notes, or ephemeral testing states (*"verified today"*, *"dummy course had 76 rows"*, *"typed from a live response"*).
- ❌
  ```text
  deleteThing wraps /ajax/thing/delete/, verified today: it destroys the pool
  row, so every level sharing it loses the row, and a repeat call answers 404.
  ```
- ✅
  ```text
  Add deleteThing endpoint wrapper

  Permanently deletes a shared pool row via /ajax/thing/delete/.
  ```

#### 3. Conversational Drama & Double-Hyphen Dashes
- ❌
  ```text
  deleteThingFromLevel never deleted anything -- it detaches a row from one
  level and leaves it in the pool, which is why the dummy course had 76 rows
  attached to nothing. It is now detachThingFromLevel, with the old name kept
  as a deprecated alias.
  ```
- ✅
  ```text
  Rename deleteThingFromLevel to detachThingFromLevel

  The endpoint only disassociates rows from a level without deleting the
  underlying pool record. Retain deleteThingFromLevel as a deprecated alias.
  ```

---


### For Commit Messages:
````markdown
### Commit `<commit-hash>`: `<Subject line>`
- **Original:** `<original commit message text>`
- **Anti-Pattern:** `<Anti-Pattern Name(s)>`
- **Issue:** `<1-sentence explanation of what makes it noise/bloat>`
- **Replacement:**
  ```text
  <Clean proposed subject line>

  <Clean proposed body wrapped at 72 chars>
  ```
````
