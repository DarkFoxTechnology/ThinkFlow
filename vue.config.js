
module.exports = {
  publicPath:
    process.env.NODE_ENV === "production"
      ? "/https://github.com/DarkFoxTechnology/ThinkFlow.git/" // 替换成你的 GitHub 仓库名
      : "/",
  outputDir: "dist",
}; 