import type { ApiError } from '@mohhey/contracts'

export class HttpError extends Error {
  constructor(public status: number, public code: ApiError['code'], message: string) { super(message) }
}
export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} was not found.`)
export const badRequest = (msg: string) => new HttpError(400, 'validation', msg)
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg)
