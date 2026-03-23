import { redirect } from 'next/navigation'

export default function SignUpCatchAll() {
  redirect('/sign-in')
}
