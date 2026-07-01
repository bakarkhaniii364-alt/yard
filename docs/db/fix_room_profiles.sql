-- SQL to fix the mismatched partner profile block in room_profiles
-- Room ID: 7f75683c-cbc0-49b0-afe2-30000dd37f16
-- User ID: eb0ce66e-d0aa-4de4-a8ea-d400eceda26e (Alif)
-- Paired Partner ID: 22a3c12a-c4df-4e7f-9633-273585a3552f (RampaRampa)
-- Mismatched Old Partner ID: a27e5b43-97e6-4cfa-9edd-c9d4c3c07067 (Marc Spector)

UPDATE public.app_state
SET state = jsonb_set(
  state,
  '{room_profiles}',
  (COALESCE(state->'room_profiles', '{}'::jsonb) - 'a27e5b43-97e6-4cfa-9edd-c9d4c3c07067') || 
  jsonb_build_object(
    '22a3c12a-c4df-4e7f-9633-273585a3552f',
    jsonb_build_object(
      'name', 'RampaRampa',
      'userStatus', 'active',
      'e2ee_public_key', '{"crv": "P-256", "ext": true, "key_ops": [], "kty": "EC", "x": "27POCf0oFrDJ4-pUAsAKBJhoxYxqyHz2s2p3U5_m0PE", "y": "iDgHcol2ngQ19puV5ieKJQZjgT4ULoo0PXBkxWdi1SA"}'::jsonb,
      'e2ee_salt', 'Z5LqSLX4BNtN0iPHBOfUEA==',
      'encrypted_private_key', '{"ciphertext": "QWIaAIbbp1S7Cc6PxvCc65OIIBbVLOE+bqgFACFG2KP1iARP4ADgEypXyhW6i1IjTI7go4Pk+5t+nMnPEwDqiofR30wihqzhmcxh5s2HN1soS2bC7SgdnBrR+mmXh98wgyo8EIwaFkCEF1G+HrNBC4/+vmUZqab/Pw12Gh/T/7LKEtRk6A+N9Vd81t6s9AGWzzQjfdb3oEg6nr1YbzW8IdCZJ2B0k+Bh1mkj/cQh64G9n4MsJhPGuEw3hxx59SYh8vNrYfLaUBtY3DXntfUqsV5rtWl7vUD4wHiXTnP0F4XfnqEBROrzyelc2br6F0YK", "iv": "2MErrBO5g6TQb9Z8"}'::jsonb
    )
  )
)
WHERE room_id = '7f75683c-cbc0-49b0-afe2-30000dd37f16';
