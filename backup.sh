#!/bin/bash
# 数据库备份脚本

BACKUP_DIR="./backups"
DB_FILE="./data/database.sqlite"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/database_${TIMESTAMP}.sqlite"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份数据库
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_FILE"
    echo "✅ 备份成功: $BACKUP_FILE"
    
    # 只保留最近7天的备份
    find "$BACKUP_DIR" -name "database_*.sqlite" -mtime +7 -delete
    echo "🗑️  已清理7天前的旧备份"
else
    echo "❌ 数据库文件不存在: $DB_FILE"
    exit 1
fi

