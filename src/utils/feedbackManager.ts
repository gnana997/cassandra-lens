/**
 * Feedback Manager - Handles user feedback prompts and tracking
 *
 * Strategy:
 * - Prompt after 10 successful query executions
 * - Only prompt once per installation
 * - Respect user's choice (don't ask again if declined)
 */

import * as vscode from 'vscode';

export class FeedbackManager {
  private static readonly USAGE_COUNT_KEY = 'cassandraLens.queryExecutionCount';
  private static readonly FEEDBACK_SHOWN_KEY = 'cassandraLens.feedbackPromptShown';
  private static readonly FEEDBACK_DISMISSED_KEY = 'cassandraLens.feedbackDismissed';
  private static readonly PROMPT_THRESHOLD = 10; // Show after 10 queries

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Track query execution and potentially show feedback prompt
   */
  async trackQueryExecution(): Promise<void> {
    // Get current counts
    const usageCount = this.context.globalState.get<number>(
      FeedbackManager.USAGE_COUNT_KEY,
      0
    );
    const feedbackShown = this.context.globalState.get<boolean>(
      FeedbackManager.FEEDBACK_SHOWN_KEY,
      false
    );
    const feedbackDismissed = this.context.globalState.get<boolean>(
      FeedbackManager.FEEDBACK_DISMISSED_KEY,
      false
    );

    // Increment usage count
    const newCount = usageCount + 1;
    await this.context.globalState.update(
      FeedbackManager.USAGE_COUNT_KEY,
      newCount
    );

    // Show prompt if threshold reached and not shown/dismissed before
    if (
      newCount === FeedbackManager.PROMPT_THRESHOLD &&
      !feedbackShown &&
      !feedbackDismissed
    ) {
      await this.showFeedbackPrompt();
    }
  }

  /**
   * Show feedback prompt to user
   */
  private async showFeedbackPrompt(): Promise<void> {
    const response = await vscode.window.showInformationMessage(
      '🎉 You\'ve executed 10 queries with CassandraLens! How\'s your experience so far?',
      { modal: false },
      'Share Feedback',
      'Report Issue',
      'Remind Me Later',
      'Don\'t Ask Again'
    );

    await this.context.globalState.update(
      FeedbackManager.FEEDBACK_SHOWN_KEY,
      true
    );

    switch (response) {
      case 'Share Feedback':
        await this.openFeedbackPage();
        break;

      case 'Report Issue':
        await this.openIssuesPage();
        break;

      case 'Don\'t Ask Again':
        await this.context.globalState.update(
          FeedbackManager.FEEDBACK_DISMISSED_KEY,
          true
        );
        break;

      case 'Remind Me Later':
        // Reset the shown flag so we can ask again after more usage
        await this.context.globalState.update(
          FeedbackManager.FEEDBACK_SHOWN_KEY,
          false
        );
        // Reset counter to trigger again after another 10 queries
        await this.context.globalState.update(
          FeedbackManager.USAGE_COUNT_KEY,
          0
        );
        break;

      default:
        // User dismissed the notification (clicked X)
        // Do nothing, we'll ask again next time based on the logic
        break;
    }
  }

  /**
   * Open GitHub Discussions for general feedback
   */
  private async openFeedbackPage(): Promise<void> {
    const feedbackUrl = 'https://github.com/gnana997/cassandra-lens/discussions/new?category=feedback';

    try {
      await vscode.env.openExternal(vscode.Uri.parse(feedbackUrl));
      vscode.window.showInformationMessage(
        'Thank you for taking the time to share your feedback! 🙏'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open feedback page. Please visit: ${feedbackUrl}`
      );
    }
  }

  /**
   * Open GitHub Issues for bug reports
   */
  private async openIssuesPage(): Promise<void> {
    const issuesUrl = 'https://github.com/gnana997/cassandra-lens/issues/new/choose';

    try {
      await vscode.env.openExternal(vscode.Uri.parse(issuesUrl));
      vscode.window.showInformationMessage(
        'Thank you for helping improve CassandraLens! 🐛'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open issues page. Please visit: ${issuesUrl}`
      );
    }
  }

  /**
   * Manual feedback command (accessible via command palette)
   */
  async showManualFeedbackPrompt(): Promise<void> {
    const response = await vscode.window.showInformationMessage(
      'How can we help improve CassandraLens?',
      { modal: false },
      'Share Feedback',
      'Report Bug',
      'Request Feature',
      'View Documentation'
    );

    switch (response) {
      case 'Share Feedback':
        await this.openFeedbackPage();
        break;

      case 'Report Bug':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/gnana997/cassandra-lens/issues/new?template=bug_report.md')
        );
        break;

      case 'Request Feature':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/gnana997/cassandra-lens/issues/new?template=feature_request.md')
        );
        break;

      case 'View Documentation':
        await vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/gnana997/cassandra-lens#readme')
        );
        break;
    }
  }

  /**
   * Get current usage statistics (for debugging)
   */
  getUsageStats(): { queryCount: number; feedbackShown: boolean; dismissed: boolean } {
    return {
      queryCount: this.context.globalState.get(FeedbackManager.USAGE_COUNT_KEY, 0),
      feedbackShown: this.context.globalState.get(FeedbackManager.FEEDBACK_SHOWN_KEY, false),
      dismissed: this.context.globalState.get(FeedbackManager.FEEDBACK_DISMISSED_KEY, false),
    };
  }

  /**
   * Reset all feedback tracking (for testing)
   */
  async resetFeedbackTracking(): Promise<void> {
    await this.context.globalState.update(FeedbackManager.USAGE_COUNT_KEY, 0);
    await this.context.globalState.update(FeedbackManager.FEEDBACK_SHOWN_KEY, false);
    await this.context.globalState.update(FeedbackManager.FEEDBACK_DISMISSED_KEY, false);
    vscode.window.showInformationMessage('Feedback tracking reset.');
  }
}
