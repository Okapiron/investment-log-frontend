import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  const args = { json: false, skipBuild: false, envFile: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '')
    if (token === '--json') args.json = true
    if (token === '--skip-build') args.skipBuild = true
    if (token === '--env-file') {
      args.envFile = String(argv[i + 1] || '')
      i += 1
    }
  }
  return args
}

function runCommand(command, commandArgs, { capture = false } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf-8',
  })
  const stdout = String(result.stdout || '').trim()
  const stderr = String(result.stderr || '').trim()
  return {
    code: Number(result.status || 0),
    stdout,
    stderr,
  }
}

function parseJson(text) {
  const raw = String(text || '').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return { raw_output: raw }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  const envCheckArgs = ['tools/check_release_env.mjs', '--strict', '--json']
  if (args.envFile) {
    envCheckArgs.push('--env-file', args.envFile)
  }

  const envCheck = runCommand('node', envCheckArgs, { capture: true })
  const envPayload = parseJson(envCheck.stdout || envCheck.stderr)
  if (envCheck.code !== 0) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: 'failed',
            checks: {
              env: envPayload,
            },
            exit_code: envCheck.code,
          },
        ),
      )
    }
    process.exit(envCheck.code)
  }

  if (args.skipBuild) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: 'ok',
            checks: {
              env: envPayload,
              build: { skipped: true, exit_code: 0 },
            },
            exit_code: 0,
          },
        ),
      )
    } else {
      console.log('FRONTEND PREFLIGHT: OK (build skipped)')
    }
    process.exit(0)
  }

  const build = runCommand('npm', ['run', 'build'], { capture: args.json })
  if (build.code !== 0) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: 'failed',
            checks: {
              env: envPayload,
              build: {
                exit_code: build.code,
                stderr: build.stderr || undefined,
                stdout: build.stdout || undefined,
              },
            },
            exit_code: build.code,
          },
        ),
      )
    }
    process.exit(build.code)
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          checks: {
            env: envPayload,
            build: { exit_code: 0 },
          },
          exit_code: 0,
        },
      ),
    )
  } else {
    console.log('FRONTEND PREFLIGHT: OK')
  }
}

main()
