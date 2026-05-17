export interface CommitPayload {
  filesChanged: number;
  summary: string;
  language?: string;
}

export interface GeneratedCommitMessage {
  message: string;
  timestamp: number;
}
