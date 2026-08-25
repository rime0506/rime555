# 使用 Node.js 20 官方镜像
FROM node:20-alpine

# 安装 better-sqlite3 所需的编译工具
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV DB_PATH=/app/data/database.sqlite

# 启动服务
CMD ["node", "server.js"]


