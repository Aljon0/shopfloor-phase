import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('writes headers and rows with CRLF endings', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x')
  })

  it('quotes cells containing commas, quotes and newlines', () => {
    expect(toCsv(['n'], [['a,b'], ['say "hi"'], ['l1\nl2']])).toBe('n\r\n"a,b"\r\n"say ""hi"""\r\n"l1\nl2"')
  })

  it('leaves null and undefined cells empty', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,')
  })

  it('neutralizes spreadsheet formulas in text cells but keeps negative numbers', () => {
    expect(toCsv(['v'], [['=SUM(A1:A2)'], ['@cmd'], [-5]])).toBe("v\r\n'=SUM(A1:A2)\r\n'@cmd\r\n-5")
  })
})
