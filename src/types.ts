export type Customer = {
  customerId: string
  customerName: string
  seats?: string
  segment?: string
  secondaryContactName?: string
  secondaryContactEmail?: string
  czLink?: string
}

export type Migration = {
  migrationId: string
  customerId: string
  customerName: string
  stage: string
  daysInStage?: string | number
  status?: string
  githubStatus?: string
  githubIssue?: string
  ownerEmail?: string
  startDate?: string
  goLiveDate?: string
}

export type Activity = {
  activityId: string
  migrationId: string
  type?: string
  summary?: string
  createdAt?: string
  actorEmail?: string
  newStage?: string
}

export type Owner = {
  ownerEmail: string
  ownerName?: string
  ownerRole?: string
}

export type StageThreshold = {
  stage: string
  behindThresholdDays?: string
  responsibleParty?: string
}


