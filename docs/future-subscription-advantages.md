Reviewing the subscription system to identify potential higher-tier advantages.


[3 tools called]


Checking current features and usage limits to identify potential higher-tier advantages:


[3 tools called]


Reviewing the settings components to understand current features:


[2 tools called]


Potential advantages for higher-tier subscriptions:

## Current System
- Model access (free → basic → plus → pro)
- Basic generation features
- Priority support (basic+)
- Early access to features (pro)

## Potential Future Advantages

### 1. Usage Limits & Quotas
- Generation limits per month:
  - Free: 5–10 summaries/month
  - Basic: 50–100 summaries/month
  - Plus: 500 summaries/month
  - Pro: Unlimited
- PDF size limits:
  - Free: 10 pages max
  - Basic: 50 pages
  - Plus: 200 pages
  - Pro: Unlimited
- Token/character limits per generation:
  - Free: 5K tokens
  - Basic: 20K tokens
  - Plus: 100K tokens
  - Pro: Unlimited

### 2. Advanced Generation Features
- Batch processing: process multiple PDFs at once (Plus/Pro)
- Custom prompts/guidelines: save and reuse custom guidelines (Basic+)
- Advanced refinement: multiple refinement passes (Plus/Pro)
- Export formats: PDF, DOCX, LaTeX (Plus/Pro)
- Multi-language support: summaries in multiple languages (Plus/Pro)
- Section-by-section processing: process large documents in chunks (Pro)

### 3. Quality & Performance
- Faster processing: priority queue (Basic+)
- Higher quality modes: "exam-focused" vs "comprehensive" (Plus/Pro)
- Custom model fine-tuning: adjust generation parameters (Pro)
- Quality scoring: AI-generated quality scores for outputs (Pro)

### 4. Storage & History
- History retention:
  - Free: 30 days
  - Basic: 90 days
  - Plus: 1 year
  - Pro: Unlimited
- Storage limits:
  - Free: 10 documents
  - Basic: 100 documents
  - Plus: 500 documents
  - Pro: Unlimited
- Cloud sync: automatic backup to Notion/Google Drive (Plus/Pro)

### 5. Collaboration & Sharing
- Share summaries: shareable links (Basic+)
- Team workspaces: collaborate with others (Pro)
- Comments/annotations: add notes to summaries (Plus/Pro)
- Version history: track changes over time (Pro)

### 6. Analytics & Insights
- Usage analytics: detailed stats dashboard (Basic+)
- Study progress tracking: track learning progress (Plus/Pro)
- Performance metrics: time spent, topics covered (Pro)
- Export analytics: CSV/JSON export of usage data (Pro)

### 7. API Access
- REST API: programmatic access (Plus/Pro)
- Webhooks: receive notifications on completion (Pro)
- Rate limits: higher API rate limits (Pro)
- API documentation: full API access (Pro)

### 8. Advanced Study Features
- Spaced repetition: built-in flashcard scheduling (Plus/Pro)
- Study plans: AI-generated study schedules (Pro)
- Progress tracking: track mastery of topics (Pro)
- Exam simulation: practice exams from summaries (Pro)

### 9. Customization
- Custom themes: more theme options (Basic+)
- Branding: remove "Powered by Zemni" (Pro)
- Custom domains: white-label solution (Pro)
- Custom integrations: connect to other tools (Pro)

### 10. Support & Service
- Response time:
  - Free: Community support
  - Basic: 48-hour response
  - Plus: 24-hour response
  - Pro: 4-hour response + dedicated support
- Onboarding: personalized onboarding (Pro)
- Feature requests: priority consideration (Pro)

### 11. Security & Compliance
- Advanced encryption: additional security options (Plus/Pro)
- Compliance: GDPR/SOC 2 compliance features (Pro)
- Audit logs: detailed activity logs (Pro)
- SSO: Single Sign-On for teams (Pro)

### 12. Monetization Features (for Pro users)
- Resell summaries: ability to sell generated content (Pro)
- White-label: resell the platform (Pro)
- Affiliate program: earn commissions (Pro)

## Implementation Priority Recommendations

High value, easy to implement:
1. Usage limits per tier
2. PDF size limits
3. History retention limits
4. Faster processing (priority queue)
5. Advanced export formats

Medium priority:
6. Batch processing
7. Custom prompts/guidelines
8. Shareable links
9. Usage analytics dashboard
10. API access

Long-term:
11. Team workspaces
12. Spaced repetition system
13. Study progress tracking
14. White-label options

The subscription system already supports tier-based features. You can add these by checking `userTier` in API routes and UI components, similar to the model availability checks.