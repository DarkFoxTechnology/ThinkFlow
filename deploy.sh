#!/usr/bin/env sh

# 当发生错误时中止脚本
set -e

# 构建
npm run build

# 进入构建文件夹
cd dist

# 如果你要部署到自定义域名
# echo 'www.example.com' > CNAME

git init
git add -A
git commit -m 'deploy'

# 如果你要部署到 https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:DarkFoxTechnology/ThinkFlow.git main:gh-pages

cd - 