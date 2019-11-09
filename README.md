# CMS Ranking Archiver

This program crawls the data from a CMS Ranking Web Server (RWS) and generates a static web page

That means you can host it on GitHub Pages!

## Usage

```
usage: rws-archiver.py [-h] [-s SESSIONS] [-r RETRY] [--html] [--css]
                       [--nofaces] [--noflags] [--nosublist]
                       url [output]

positional arguments:
  url                   URL of the CMS Ranking Web Server page
  output                Directory to output static files

optional arguments:
  -h, --help            show this help message and exit
  -s SESSIONS, --sessions SESSIONS
                        Number of sessions
  -r RETRY, --retry RETRY
                        Times to retry for each response
  --html                Crawl the page's HTML
  --css                 Crawl the page's CSS
  --nofaces             Don't crawl user faces
  --noflags             Don't crawl team flags
  --nosublist           Don't crawl detailed submission info
```

#### Required

`url` : It should be like https://ranking.ioi2019.az or https://ranking.ioi2019.az/Ranking.html

#### Optional

`output` : Path to output static files. Will be the first contest name if not specified.
