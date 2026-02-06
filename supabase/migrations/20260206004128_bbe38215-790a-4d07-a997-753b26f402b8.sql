-- Allow participants to update their conversations (specifically book_id)
CREATE POLICY "Participants can update their conversations"
ON public.conversations
FOR UPDATE
USING ((auth.uid() = participant_1) OR (auth.uid() = participant_2))
WITH CHECK ((auth.uid() = participant_1) OR (auth.uid() = participant_2));