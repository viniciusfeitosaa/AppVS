-- YouTube opcional em rascunhos de conteúdo
ALTER TABLE "conteudo_eventos" ALTER COLUMN "youtube_url" DROP NOT NULL;
ALTER TABLE "conteudo_eventos" ALTER COLUMN "youtube_video_id" DROP NOT NULL;
