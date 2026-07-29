/**
 * 安全与格式化工具
 * 满足 NFR3：报告中不得泄露环境变量、密钥类内容；错误堆栈须过滤敏感路径外的凭据信息
 * 满足 NFR2：堆栈关键行截断至可读长度
 */

/** 敏感信息模式：环境变量赋值、常见密钥名、Authorization 头等 */
const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  // 环境变量赋值形如 KEY=VALUE（但允许纯路径形如 PATH=/usr/bin，故仅匹配明显的凭据名）
  /\b(API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|ACCESS_KEY|AUTH)[A-Z_]*\s*[:=]\s*\S+/gi,
  // Authorization 头
  /Authorization\s*:\s*Bearer\s+\S+/gi,
  // npm/yarn token
  /\b(npm_[A-Za-z0-9]{20,})\b/g,
  // 常见 token 形状（长十六进制/base64 串），保守匹配，避免误伤普通路径
  /\b(eyJ[A-Za-z0-9_-]{10,})[A-Za-z0-9_.-]*\b/g,
];

const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * 过滤文本中的敏感信息。将匹配到的敏感片段替换为占位符。
 */
export function redactSensitive(text: string | undefined | null): string | undefined {
  if (text === undefined || text === null || text === '') {
    return undefined;
  }
  let result = String(text);
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACTION_PLACEHOLDER);
  }
  return result;
}

/** 堆栈关键行最大长度（单条），超过则截断并标注 */
const STACK_MAX_LENGTH = 500;

/**
 * 截断堆栈，保留前若干关键行（含错误首行与栈顶），超过最大长度截断并标注。
 */
export function truncateStack(stack: string | undefined | null): string | undefined {
  if (stack === undefined || stack === null || stack === '') {
    return undefined;
  }
  const trimmed = String(stack).trim();
  if (trimmed.length <= STACK_MAX_LENGTH) {
    return trimmed;
  }
  // 优先保留前几行（错误首行与栈顶），其余截断
  const lines = trimmed.split(/\r?\n/);
  const kept: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (total + line.length + 1 > STACK_MAX_LENGTH) {
      break;
    }
    kept.push(line);
    total += line.length + 1;
  }
  return `${kept.join('\n')}\n...(堆栈已截断，原始长度 ${trimmed.length} 字符)`;
}

/**
 * 截断错误信息至可读长度。
 */
export function truncateMessage(message: string | undefined | null, max = 300): string | undefined {
  if (message === undefined || message === null || message === '') {
    return undefined;
  }
  const str = String(message).trim();
  if (str.length <= max) {
    return str;
  }
  return `${str.slice(0, max)}...(已截断)`;
}

/** 安全读取对象字段：不存在或类型不符返回 undefined */
export function safeRead(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== 'object') {
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  return key in record ? record[key] : undefined;
}

/** 安全读取数值：无效返回 undefined */
export function safeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** 安全读取字符串：非字符串或空返回 undefined */
export function safeString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return undefined;
}

/**
 * 对敏感信息做综合清洗：先 redact 再截断堆栈，用于失败用例的 errorMessage/stackTrace。
 */
export function sanitizeFailure(
  message: string | undefined | null,
  stack: string | undefined | null,
): { errorMessage?: string; stackTrace?: string } {
  const cleanMessage = truncateMessage(redactSensitive(message));
  const cleanStack = truncateStack(redactSensitive(stack));
  const result: { errorMessage?: string; stackTrace?: string } = {};
  if (cleanMessage) result.errorMessage = cleanMessage;
  if (cleanStack) result.stackTrace = cleanStack;
  return result;
}
