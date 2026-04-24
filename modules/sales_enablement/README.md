# Sales Enablement Module

Call transcript ingestion, scoring, summaries, coaching prompts, and rep performance insights.

## First Foundation Slice

- ingest one consultation transcript against an existing appointment
- persist transcript + analysis as first-class records
- emit transcript received, analysis completed, and score recorded events
- show recent transcript outcomes in the dashboard and API
- surface rep-level coaching metrics (volume, score trends, top objections, coaching focus)

## Adapter Sync Path

- run adapter-backed transcript import via `syncConsultationTranscripts`
- start with `dev_capture` static adapter records
- dedupe using `externalId` per workspace/source before insert
