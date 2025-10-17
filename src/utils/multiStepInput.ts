/**
 * Multi-Step Input Utility
 *
 * Provides a reusable pattern for creating multi-step input flows
 * in VS Code extensions using QuickPick and InputBox APIs.
 *
 * Adapted from Microsoft's official vscode-extension-samples:
 * https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/multiStepInput.ts
 */

import * as vscode from 'vscode';

/**
 * Configuration for an input step.
 */
interface InputStep {
  /**
   * Title shown at the top of the input UI.
   * Should include step indicator (e.g., "Add Connection (1/7)").
   */
  title: string;

  /**
   * Current step number (1-based).
   */
  step: number;

  /**
   * Total number of steps in the flow.
   */
  totalSteps: number;

  /**
   * Placeholder text shown in the input box.
   */
  placeholder: string;

  /**
   * Prompt text shown above the input box.
   */
  prompt?: string;

  /**
   * Default value for the input.
   */
  value?: string;

  /**
   * Whether this is a password input (characters are hidden).
   */
  password?: boolean;

  /**
   * Validation function that checks the input.
   * Return undefined if valid, or an error message if invalid.
   */
  validate?: (value: string) => Promise<string | undefined>;

  /**
   * Whether the user can navigate back from this step.
   */
  canGoBack?: boolean;
}

/**
 * Configuration for a QuickPick selection step.
 */
interface QuickPickStep<T extends vscode.QuickPickItem> {
  /**
   * Title shown at the top of the QuickPick UI.
   */
  title: string;

  /**
   * Current step number (1-based).
   */
  step: number;

  /**
   * Total number of steps in the flow.
   */
  totalSteps: number;

  /**
   * Placeholder text shown in the QuickPick.
   */
  placeholder: string;

  /**
   * Items to display in the QuickPick.
   */
  items: T[];

  /**
   * Currently active item.
   */
  activeItem?: T;

  /**
   * Whether the user can navigate back from this step.
   */
  canGoBack?: boolean;

  /**
   * Whether the user can select multiple items.
   */
  canSelectMany?: boolean;
}

/**
 * A multi-step input flow using VS Code's QuickPick and InputBox APIs.
 *
 * **Features:**
 * - Navigate forward and backward through steps
 * - Display step progress (e.g., "Step 2/5")
 * - Input validation with error messages
 * - Support for both text input and QuickPick selections
 * - Handles cancellation and errors gracefully
 *
 * **Example Usage:**
 * ```typescript
 * const multiStep = new MultiStepInput();
 * const state = { name: '', port: 9042 };
 *
 * await multiStep.run(async (input) => {
 *   state.name = await input.showInputBox({
 *     title: 'Add Connection (1/2)',
 *     step: 1,
 *     totalSteps: 2,
 *     placeholder: 'My Cluster',
 *     prompt: 'Enter connection name',
 *     validate: async (value) => value.length === 0 ? 'Name is required' : undefined
 *   });
 *
 *   state.port = parseInt(await input.showInputBox({
 *     title: 'Add Connection (2/2)',
 *     step: 2,
 *     totalSteps: 2,
 *     value: '9042',
 *     placeholder: '9042',
 *     prompt: 'Enter port number'
 *   }));
 * });
 *
 * console.log('Connection:', state.name, state.port);
 * ```
 */
export class MultiStepInput {
  /**
   * Runs a multi-step input flow.
   *
   * @param start - Function that defines the input flow steps
   * @returns Promise that resolves when flow completes
   * @throws UserCancelledError if user cancels the flow
   */
  static async run<T>(start: (input: MultiStepInput) => Thenable<void>) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  /**
   * Current step number in the input flow.
   */
  private current?: vscode.QuickInput;

  /**
   * Stack of previous steps for back navigation.
   */
  private steps: ((input: MultiStepInput) => Thenable<any>)[] = [];

  /**
   * Executes the multi-step input flow.
   *
   * @private
   */
  private async stepThrough<T>(start: (input: MultiStepInput) => Thenable<T>) {
    let step: ((input: MultiStepInput) => Thenable<any>) | undefined = start;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (err) {
        if (err === InputFlowAction.back) {
          this.steps.pop();
          step = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          step = undefined;
        } else {
          throw err;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
  }

  /**
   * Shows an input box for text entry.
   *
   * @param config - Input box configuration
   * @returns The entered text value
   */
  async showInputBox(config: InputStep): Promise<string> {
    const disposables: vscode.Disposable[] = [];
    try {
      return await new Promise<string>((resolve, reject) => {
        const input = vscode.window.createInputBox();
        input.title = config.title;
        input.step = config.step;
        input.totalSteps = config.totalSteps;
        input.value = config.value || '';
        input.placeholder = config.placeholder;
        input.prompt = config.prompt;
        input.password = config.password || false;
        input.ignoreFocusOut = true;
        input.buttons = config.canGoBack !== false ? [vscode.QuickInputButtons.Back] : [];

        let validating = Promise.resolve<string | undefined>(undefined);

        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === vscode.QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            }
          }),
          input.onDidAccept(async () => {
            const value = input.value;
            input.enabled = false;
            input.busy = true;

            // Validate input
            if (config.validate) {
              const error = await config.validate(value);
              if (error) {
                input.validationMessage = error;
                input.enabled = true;
                input.busy = false;
                return;
              }
            }

            resolve(value);
          }),
          input.onDidChangeValue(async (text) => {
            const current = config.validate ? config.validate(text) : Promise.resolve(undefined);
            validating = current;
            const error = await current;
            if (current === validating) {
              input.validationMessage = error;
            }
          }),
          input.onDidHide(() => {
            reject(InputFlowAction.cancel);
          })
        );

        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  /**
   * Shows a QuickPick for selecting from a list of items.
   *
   * @param config - QuickPick configuration
   * @returns The selected item
   */
  async showQuickPick<T extends vscode.QuickPickItem>(
    config: QuickPickStep<T>
  ): Promise<T> {
    const disposables: vscode.Disposable[] = [];
    try {
      return await new Promise<T>((resolve, reject) => {
        const input = vscode.window.createQuickPick<T>();
        input.title = config.title;
        input.step = config.step;
        input.totalSteps = config.totalSteps;
        input.placeholder = config.placeholder;
        input.ignoreFocusOut = true;
        input.items = config.items;
        if (config.activeItem) {
          input.activeItems = [config.activeItem];
        }
        input.canSelectMany = config.canSelectMany || false;
        input.buttons = config.canGoBack !== false ? [vscode.QuickInputButtons.Back] : [];

        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === vscode.QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            }
          }),
          input.onDidAccept(() => {
            const item = input.selectedItems[0];
            if (item) {
              resolve(item);
            }
          }),
          input.onDidHide(() => {
            reject(InputFlowAction.cancel);
          })
        );

        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }
}

/**
 * Flow actions for navigation and cancellation.
 *
 * @private
 */
enum InputFlowAction {
  back,
  cancel,
}
