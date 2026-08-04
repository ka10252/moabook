import { z } from 'zod';

/**
 * 가입 비밀번호 정책 — 영문자·숫자·특수문자 각 1자 이상, 6자 이상.
 * 로그인(signIn)에는 적용하지 않는다: 정책 도입 이전에 가입한 유저가 잠기면 안 된다.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: '6자 이상', test: (v: string) => v.length >= 6 },
  { id: 'letter', label: '영문', test: (v: string) => /[A-Za-z]/.test(v) },
  { id: 'number', label: '숫자', test: (v: string) => /[0-9]/.test(v) },
  { id: 'special', label: '특수문자', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const passwordSchema = z
  .string()
  .max(100)
  .min(6, { message: '비밀번호는 6자 이상이어야 합니다' })
  .regex(/[A-Za-z]/, { message: '비밀번호에 영문자를 1자 이상 포함해주세요' })
  .regex(/[0-9]/, { message: '비밀번호에 숫자를 1자 이상 포함해주세요' })
  .regex(/[^A-Za-z0-9]/, { message: '비밀번호에 특수문자를 1자 이상 포함해주세요' });

export const isPasswordValid = (value: string) => PASSWORD_RULES.every((rule) => rule.test(value));
