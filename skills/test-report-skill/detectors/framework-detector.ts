/**
 * 框架/命令识别器（T1.7）
 *
 * 按优先级（FR1.1）识别项目测试框架与运行命令：
 *   1. 用户显式指定的命令（最高优先级）
 *   2. package.json scripts.test
 *   3. pyproject.toml / Cargo.toml
 *   4. 框架特征文件推断（jest.config.* / vitest.config.* / pytest.ini）
 *
 * 识别失败返回明确诊断信息（FR1.4）
 */
import * as fs from 'fs';
import * as path from 'path';

export interface DetectionResult {
  /** 识别到的测试命令 */
  command: string;
  /** 识别到的框架名 */
  framework: string;
  /** 结果文件路径提示（执行后结果落盘位置） */
  resultFileHint: string;
}

export class FrameworkDetector {
  /**
   * 识别测试框架与运行命令
   * @param projectRoot 项目根目录
   * @param userCommand 用户显式指定的命令（可选）
   */
  detect(projectRoot: string, userCommand?: string): DetectionResult {
    // 优先级 1：用户显式命令
    if (userCommand && userCommand !== 'auto') {
      return {
        command: userCommand,
        framework: this.guessFrameworkFromCommand(userCommand),
        resultFileHint: this.guessResultFile(userCommand, projectRoot),
      };
    }

    const checkedSources: string[] = [];

    // 优先级 2：package.json scripts.test
    const pkgResult = this.checkPackageJson(projectRoot);
    if (pkgResult) {
      return pkgResult;
    }
    checkedSources.push('package.json scripts.test');

    // 优先级 3：pyproject.toml / Cargo.toml
    const pyResult = this.checkPyproject(projectRoot);
    if (pyResult) {
      return pyResult;
    }
    checkedSources.push('pyproject.toml');
    const cargoResult = this.checkCargo(projectRoot);
    if (cargoResult) {
      return cargoResult;
    }
    checkedSources.push('Cargo.toml');

    // 优先级 4：框架特征文件推断
    const featureResult = this.checkFeatureFiles(projectRoot);
    if (featureResult) {
      return featureResult;
    }
    checkedSources.push('jest.config.* / vitest.config.* / pytest.ini');

    // 识别失败（FR1.4）
    throw new Error(
      `[framework-detector] 无法自动识别项目的测试框架与运行命令。\n` +
        `已检查的配置来源:\n` +
        checkedSources.map((s) => `  - ${s}`).join('\n') +
        `\n建议：\n` +
        `  1. 在 package.json 中添加 "scripts.test" 字段；\n` +
        `  2. 或安装 Jest/Vitest 并添加配置文件（jest.config.js / vitest.config.ts）；\n` +
        `  3. 或在调用时显式指定 test_command 参数。`
    );
  }

  private checkPackageJson(root: string): DetectionResult | null {
    const pkgPath = path.join(root, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const testScript = pkg.scripts?.test;
      if (testScript && testScript !== 'echo "Error: no test specified" && exit 1') {
        return {
          command: `npm test`,
          framework: this.guessFrameworkFromCommand(testScript),
          resultFileHint: this.guessResultFile(testScript, root),
        };
      }
      // 无 test script，检查 devDependencies 是否有 jest/vitest
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      if (allDeps['jest']) {
        return {
          command: 'npx jest --json',
          framework: 'jest',
          resultFileHint: path.join(root, 'test-results.json'),
        };
      }
      if (allDeps['vitest']) {
        return {
          command: 'npx vitest run --reporter=json',
          framework: 'vitest',
          resultFileHint: path.join(root, 'test-results.json'),
        };
      }
    } catch {
      // package.json 解析失败，继续检查其他来源
    }
    return null;
  }

  private checkPyproject(root: string): DetectionResult | null {
    const pyPath = path.join(root, 'pyproject.toml');
    if (!fs.existsSync(pyPath)) return null;
    const content = fs.readFileSync(pyPath, 'utf-8');
    if (content.includes('pytest')) {
      return {
        command: 'pytest --junitxml=test-results.xml',
        framework: 'pytest',
        resultFileHint: path.join(root, 'test-results.xml'),
      };
    }
    return null;
  }

  private checkCargo(root: string): DetectionResult | null {
    const cargoPath = path.join(root, 'Cargo.toml');
    if (!fs.existsSync(cargoPath)) return null;
    // cargo test 不在 P0 范围，但识别到时提示
    return {
      command: 'cargo test',
      framework: 'cargo',
      resultFileHint: path.join(root, 'target/test-results.xml'),
    };
  }

  private checkFeatureFiles(root: string): DetectionResult | null {
    const jestPatterns = [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.json',
      'jest.config.mjs',
      'jest.config.cjs',
    ];
    for (const p of jestPatterns) {
      if (fs.existsSync(path.join(root, p))) {
        return {
          command: 'npx jest --json',
          framework: 'jest',
          resultFileHint: path.join(root, 'test-results.json'),
        };
      }
    }
    const vitestPatterns = [
      'vitest.config.ts',
      'vitest.config.js',
      'vitest.config.mts',
      'vite.config.ts',
    ];
    for (const p of vitestPatterns) {
      if (fs.existsSync(path.join(root, p))) {
        return {
          command: 'npx vitest run --reporter=json',
          framework: 'vitest',
          resultFileHint: path.join(root, 'test-results.json'),
        };
      }
    }
    if (fs.existsSync(path.join(root, 'pytest.ini'))) {
      return {
        command: 'pytest --junitxml=test-results.xml',
        framework: 'pytest',
        resultFileHint: path.join(root, 'test-results.xml'),
      };
    }
    return null;
  }

  private guessFrameworkFromCommand(cmd: string): string {
    const lower = cmd.toLowerCase();
    if (lower.includes('jest')) return 'jest';
    if (lower.includes('vitest')) return 'vitest';
    if (lower.includes('pytest')) return 'pytest';
    if (lower.includes('cargo')) return 'cargo';
    return 'unknown';
  }

  private guessResultFile(cmd: string, root: string): string {
    const lower = cmd.toLowerCase();
    if (lower.includes('junitxml') || lower.includes('junit')) {
      // 尝试提取 --junitxml=xxx 的路径
      const m = /--junitxml[=\s]+([^\s]+)/.exec(cmd);
      if (m) return path.join(root, m[1]);
      return path.join(root, 'test-results.xml');
    }
    if (lower.includes('json')) {
      const m = /--outputFile[=\s]+([^\s]+)/.exec(cmd) ||
        /--json[=\s]+([^\s]+)/.exec(cmd);
      if (m) return path.join(root, m[1]);
      return path.join(root, 'test-results.json');
    }
    // 默认按框架猜测
    const fw = this.guessFrameworkFromCommand(cmd);
    if (fw === 'junit' || fw === 'pytest') {
      return path.join(root, 'test-results.xml');
    }
    return path.join(root, 'test-results.json');
  }
}
