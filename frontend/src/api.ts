import { call } from 'frappe-ui'
import type { HomeData, Mode, Scenario } from './engine/types'

const API = 'dms_training.api.training'

export const getHome = () => call<HomeData>(`${API}.get_home`)

export const getScenario = (name: string) => call<Scenario>(`${API}.get_scenario`, { name })

export interface ProgressResult {
  name: string
  status: 'Watched' | 'Passed' | 'Needs Practice'
  score: number
}

export const saveProgress = (args: {
  scenario: string
  mode: Mode
  score: number
  hints_used: number
  mistakes: number
  time_taken: number
}) => call<ProgressResult>(`${API}.save_progress`, args)

export interface TeamRow {
  user: string
  full_name: string
  scenario: string
  track: string
  attempts: number
  best_score: number
  passed: boolean
  last_status: string
  last_on: string
}

export const getTeamProgress = () =>
  call<{ rows: TeamRow[]; scenarios: { name: string; track: string }[] }>(`${API}.get_team_progress`)

/** The message of a failed call, for showing to the user. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
