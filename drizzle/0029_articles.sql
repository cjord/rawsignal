-- Environment-local editorial storage; shared identity IDs intentionally have no auth FK.
CREATE TABLE articles (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, head_revision INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('draft','needs-review','approved','published','rejected','archived')),
 published_revision INTEGER, first_published_at TEXT, published_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_operation_id TEXT NOT NULL
);
CREATE TABLE article_revisions (
 article_id TEXT NOT NULL REFERENCES articles(id), revision INTEGER NOT NULL,
 content_json TEXT NOT NULL, references_json TEXT NOT NULL,
 author_id TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(article_id,revision)
);
CREATE TABLE article_releases (
 article_id TEXT NOT NULL REFERENCES articles(id), revision INTEGER NOT NULL,
 published_at TEXT NOT NULL, note TEXT NOT NULL,
 PRIMARY KEY(article_id,revision),
 FOREIGN KEY(article_id,revision) REFERENCES article_revisions(article_id,revision)
);
CREATE INDEX articles_publication ON articles(published_at,id) WHERE published_revision IS NOT NULL;
CREATE INDEX articles_queue ON articles(updated_at,id);
