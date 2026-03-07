import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = { strict: false, envFile: '', json: false }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--strict') args.strict = true
    if (token === '--json') args.json = true
    if (token === '--env-file') args.envFile = String(argv[i + 1] || '')
    if (token === '--env-file') i += 1
  }
  return args
}

function parseEnvFile(filePath) {
  const env = {}
  const full = path.resolve(filePath)
  if (!fs.existsSync(full)) return env
  const content = fs.readFileSync(full, 'utf-8')
  for (const line of content.split(/\r?\n/)) {
    const raw = String(line || '').trim()
    if (!raw || raw.startsWith('#')) continue
    const idx = raw.indexOf('=')
    if (idx <= 0) continue
    const key = raw.slice(0, idx).trim()
    const value = raw.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) env[key] = value
  }
  return env
}

function isTruthy(value) {
  const v = String(value || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function isBlank(value) {
  return String(value || '').trim() === ''
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const fileEnv = args.envFile ? parseEnvFile(args.envFile) : {}
  const env = { ...fileEnv, ...process.env }

  const errors = []
  const warnings = []

  const apiBase = String(env.VITE_API_BASE || '').trim()
  const authEnabled = isTruthy(env.VITE_AUTH_ENABLED)
  const supabaseUrl = String(env.VITE_SUPABASE_URL || '').trim()
  const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
  const timeoutRaw = String(env.VITE_API_TIMEOUT_MS || '').trim()
  const appVersion = String(env.VITE_APP_VERSION || '').trim()

  if (isBlank(apiBase)) {
    errors.push('VITE_API_BASE is required')
  } else if (!/^https?:\/\//.test(apiBase)) {
    errors.push('VITE_API_BASE must start with http:// or https://')
  } else if (authEnabled && !apiBase.startsWith('https://')) {
    warnings.push('VITE_API_BASE should be https:// when VITE_AUTH_ENABLED=true')
  }
  if (apiBase && !/\/api\/v1\/?$/i.test(apiBase)) {
    warnings.push('VITE_API_BASE should usually end with /api/v1')
  }

  if (authEnabled) {
    if (isBlank(supabaseUrl)) errors.push('VITE_SUPABASE_URL is required when VITE_AUTH_ENABLED=true')
    if (isBlank(supabaseAnonKey)) errors.push('VITE_SUPABASE_ANON_KEY is required when VITE_AUTH_ENABLED=true')
    if (!/^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl)) {
      warnings.push('VITE_SUPABASE_URL format looks unusual')
    }
  } else {
    warnings.push('VITE_AUTH_ENABLED is false')
  }

  if (timeoutRaw) {
    const n = Number(timeoutRaw)
    if (!Number.isFinite(n) || n <= 0) errors.push('VITE_API_TIMEOUT_MS must be a positive number')
    else if (n < 3000) warnings.push('VITE_API_TIMEOUT_MS is very low')
    else if (n > 60000) warnings.push('VITE_API_TIMEOUT_MS is very high')
  }

  if (isBlank(appVersion) || appVersion.toLowerCase() === 'dev-local') {
    warnings.push('VITE_APP_VERSION is not set for release (current value looks like local default)')
  }

  if (errors.length > 0) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: 'failed',
            strict: Boolean(args.strict),
            errors: [...errors],
            warnings: [...warnings],
            exit_code: 1,
          },
          null,
          0,
        ),
      )
    } else {
      console.log('FRONTEND CONFIG CHECK: FAILED')
      for (const e of errors) console.log(`- ERROR: ${e}`)
      for (const w of warnings) console.log(`- WARN: ${w}`)
    }
    process.exit(1)
  }

  if (args.strict && warnings.length > 0) {
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: 'failed',
            strict: true,
            errors: [],
            warnings: [...warnings],
            exit_code: 1,
          },
          null,
          0,
        ),
      )
    } else {
      console.log('FRONTEND CONFIG CHECK: FAILED (strict mode)')
      for (const w of warnings) console.log(`- WARN: ${w}`)
    }
    process.exit(1)
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          strict: Boolean(args.strict),
          errors: [],
          warnings: [...warnings],
          exit_code: 0,
        },
        null,
        0,
      ),
    )
  } else {
    console.log('FRONTEND CONFIG CHECK: OK')
    for (const w of warnings) console.log(`- WARN: ${w}`)
  }
}

main()
