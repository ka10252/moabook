-- 어드민이 받은 의견을 볼 수 있게 한다.
--
-- feedback은 원래 "쓰기만" (조회는 service_role 서버만) 이었는데,
-- 그러면 어드민 포털에서 의견을 볼 수 없다. 어드민 역할에게만 조회를 연다.
-- (일반 유저는 GRANT는 통과해도 RLS 정책에서 has_role(admin)=false라 0행)

GRANT SELECT ON public.feedback TO authenticated;

DROP POLICY IF EXISTS "feedback - admin read" ON public.feedback;
CREATE POLICY "feedback - admin read" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
