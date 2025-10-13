/**
 * Fetches all commits which are in the latest release (compares last and second-to-last releases)
 * Picks Jira issue key from the commit message
 */

import { context, getOctokit } from '@actions/github'
import * as core from '@actions/core'

const defaultApiParams = { owner: context.repo.owner, repo: context.repo.repo }


const jiraTicketRegex = new RegExp(
  `^.*(${core.getInput('project_key')}-\\d+).*`,
  'i'
)

const token = process.env.GITHUB_TOKEN
if (!token) throw new Error('GITHUB_TOKEN is not set')
const github = getOctokit(token)

async function getJiraTicketsFromCommits() {
  core.info("Action start: Fetching Jira tickets from commits")

  core.info("Project key = " + core.getInput('project_key'))

  const { data: tags } = await github.rest.repos.listTags({
    ...defaultApiParams,
    per_page: 2,
  })
  const [latestTag, previousTag] = tags

  const [latestCommit, previousCommit] = await Promise.all([
    github.rest.repos.getCommit({
      ...defaultApiParams,
      ref: latestTag.commit.sha,
    }),
    github.rest.repos.getCommit({
      ...defaultApiParams,
      ref: previousTag.commit.sha,
    }),
  ])

  // We are shifting the last commit's date one second, so to not include the commit from the previous tag
  const since = new Date(
    new Date(previousCommit.data.commit.committer.date).valueOf() + 1000
  ).toISOString()

  const commits = await github.rest.repos.listCommits({
    ...defaultApiParams,
    since,
    until: latestCommit.data.commit.committer.date,
  })


  const jiraTickets = commits.data
    .map((c) => {
       core.info('Fetched commits:', JSON.stringify(c.commit.message, null, 2))

      const regexMatches = jiraTicketRegex.exec(c.commit.message) || []

      return regexMatches[1]
    })
    .filter((el) => el)

  core.info('Found Jira tickets:', Array.from(new Set(jiraTickets)))

  return Array.from(new Set(jiraTickets)) // use Set to eliminate duplicate entries
}

export default getJiraTicketsFromCommits
