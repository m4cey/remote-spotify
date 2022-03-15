#!/bin/sh

git fetch origin main

git reset --hard origin/main

git pull origin main --force
