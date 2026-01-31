-- Drop the existing INSERT policy that only allows borrower
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;

-- Create new INSERT policy that allows both owner and borrower to create transactions
CREATE POLICY "Users can create transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = owner_id OR auth.uid() = borrower_id);