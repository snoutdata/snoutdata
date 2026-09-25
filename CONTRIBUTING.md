# Contributing

Thank you for helping. Pull requests are welcome here, for the docs and for the examples.

## How a change gets in

This repo is published from SnoutData's main repository, which is private: `docs/` is the source of
[docs.snoutdata.com](https://docs.snoutdata.com), and `examples/` and the rest are kept there too.
Each commit here is one change made there, copied across.

So a pull request here is not merged with the merge button. When we accept it, we apply your change
in the main repository with you as co-author, and the next sync brings it back here as a commit that
credits you. Your pull request is then closed with a link to that commit. Docs changes also go live
on docs.snoutdata.com at that point.

## What helps

- **Docs:** a wrong command, an unclear sentence, a missing step. Edit the file under `docs/` (every
  page on the site has an "Edit this page" link to it), or open a
  [docs issue](https://github.com/snoutdata/snoutdata/issues/new?template=docs-fix.yml).
- **Examples:** fixes to the existing ones, or a new one. Run it from a clean checkout by following
  its README before you open the pull request. To suggest one without writing it, open an
  [example request](https://github.com/snoutdata/snoutdata/issues/new?template=example-request.yml).
- **Bugs** in SnoutData Cloud, the CLI, the client or the desktop app: open a
  [bug report](https://github.com/snoutdata/snoutdata/issues/new?template=bug.yml).

Never include keys, passwords or connection strings. Security problems go to
[a private report](https://github.com/snoutdata/snoutdata/security/advisories/new), never an issue.

## Licences

By contributing you agree that your change is licensed like the files it touches: the docs under
[CC BY 4.0](./docs/LICENSE), everything else here under the [MIT License](./LICENSE).
