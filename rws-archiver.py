#!/usr/bin/env python
import grequests
import requests
from requests.packages.urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
import os
import sys
import json
import urllib3
import argparse
from distutils.dir_util import copy_tree

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

parser = argparse.ArgumentParser()
parser.add_argument("url", help="URL of the CMS Ranking Web Server page")
parser.add_argument("output", nargs="?", help="Directory to output static files")
parser.add_argument("-s", "--sessions", help="Number of sessions", type=int, default=16)
parser.add_argument("-r", "--retry", help="Times to retry for each response", type=int, default=5)
parser.add_argument("--html", help="Crawl the page's HTML", action="store_true")
parser.add_argument("--css", help="Crawl the page's CSS", action="store_true")
parser.add_argument("--nofaces", help="Don't crawl user faces", action="store_true")
parser.add_argument("--noflags", help="Don't crawl team flags", action="store_true")
parser.add_argument("--nosublist", help="Don't crawl detailed submission info", action="store_true")

args = parser.parse_args()

url = args.url
url = 'http://' + url if url.find('http') < 0 else url
if url.endswith("/"):
    url = url[:-1]
if "Ranking.html" in url:
    url = url[:url.rfind("/")]

dir_names = ["contests", "teams", "tasks", "users"]
file_names = ["logo", "scores", "history", "img/favicon.ico"]
sub_names = ["sublist", "faces", "flags"]
sub_items = [[], [], []]

NUM_SESSIONS = args.sessions
sessions = [requests.Session() for i in range(NUM_SESSIONS)]
retries = Retry(total=5,
                backoff_factor=0.1,
                status_forcelist=[500, 502, 503, 504])
for s in sessions:
    s.mount('http://', HTTPAdapter(max_retries=retries))
    s.mount('https://', HTTPAdapter(max_retries=retries))

print("Archiving CMS scoreboard from %s" % url)
print("Using %d sessions" % NUM_SESSIONS)

if args.nofaces:
    sub_names.remove("faces")
if args.noflags:
    sub_names.remove("flags")
if args.nosublist:
    sub_names.remove("sublist")
if args.html:
    file_names.append("Ranking.html")
if args.css:
    file_names.append("Ranking.css")


print("Saving directories...")
rs = [grequests.get(url + "/" + dir_names[i] + "/",
                    verify=False,
                    stream=False,
                    session=sessions[i % NUM_SESSIONS]) for i in range(len(dir_names))]
dir_reqs = grequests.map(rs)

output = args.output
if output is None:
    output = list(dir_reqs[dir_names.index("contests")].json().keys())[0]

print("Copying static files...")
copy_tree("cmsranking", output, update=1)

for i in range(len(dir_names)):
    if dir_reqs[i] is not None:
        os.makedirs(output + "/" + dir_names[i], exist_ok=True)
        open(output + "/" + dir_names[i] + "/" + "index.html", "wb").write(dir_reqs[i].content)
    else:
        print("Failed to receive directory: %s!" % dir_names[i])


print("Saving files...")
rs = [grequests.get(url + "/" + file_names[i],
                    verify=False,
                    stream=False,
                    session=sessions[i % NUM_SESSIONS]) for i in range(len(file_names))]
file_reqs = grequests.map(rs)

for i in range(len(file_names)):
    if file_reqs[i] is not None:
        if file_names[i] == "Ranking.html":
            file_names[i] = "index.html"
        open(output + "/" + file_names[i], "wb").write(file_reqs[i].content)
    else:
        print("Failed to receive file: %s!" % file_names[i])


user_req = dir_reqs[dir_names.index("users")]
team_req = dir_reqs[dir_names.index("teams")]
if not args.nosublist:
    sub_items[sub_names.index("sublist")] = list(user_req.json().keys())
if not args.nofaces:
    sub_items[sub_names.index("faces")] = list(user_req.json().keys())
if not args.noflags:
    sub_items[sub_names.index("flags")] = list(team_req.json().keys())


for i in range(len(sub_names)):
    print("Saving %s..." % sub_names[i])
    rs = [grequests.get(url + "/" + sub_names[i] + "/" + sub_items[i][j],
                        verify=False,
                        stream=False,
                        session=sessions[j % NUM_SESSIONS]) for j in range(len(sub_items[i]))]
    req = grequests.map(rs)
    os.makedirs(output + "/" + sub_names[i], exist_ok=True)
    for j in range(len(sub_items[i])):
        if req[j] is not None:
            open(output + "/" + sub_names[i] + "/" + sub_items[i][j], "wb").write(req[j].content)
        else:
            print("Failed to receive %s/%s!" % (sub_names[i], sub_items[i][j]))


asset_config = "{\"nofaces\": " + str(args.nofaces).lower() + \
               ",\"noflags\": " + str(args.noflags).lower() + \
               ",\"nosublist\": " + str(args.nosublist).lower() + "}"
open(output + "/asset_config", "w").write(asset_config)


print("%s Archived!" % url)
print("You can now use any web server (eg. nginx) to serve %s!" % output)
