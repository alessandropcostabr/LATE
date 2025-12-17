-- Seeds de custom fields iniciais para Treinamentos e Clínica
-- Data: 13/12/2025
BEGIN;

INSERT INTO custom_fields (entity, name, type, options, required, position)
VALUES
  ('opportunity','course_id','text','[]',false,1),
  ('opportunity','class_id','text','[]',false,2),
  ('opportunity','modality','select','["online","presencial","híbrido"]',false,3),
  ('opportunity','payment_method','select','["pix","cartao","boleto","dinheiro"]',false,4),
  ('opportunity','pet_name','text','[]',false,5),
  ('opportunity','species','select','["cachorro","gato","outro"]',false,6),
  ('opportunity','weight','number','[]',false,7),
  ('opportunity','urgency','select','["baixa","media","alta"]',false,8)
ON CONFLICT DO NOTHING;

COMMIT;
