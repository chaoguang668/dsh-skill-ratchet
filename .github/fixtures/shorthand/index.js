export const name = 'dsh-ci-shorthand-fixture'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'ci_shorthand_echo',
    description: 'Deliberately uses the defineTool shorthand at the raw register boundary.',
    parameters: {
      text: { type: 'string', required: true, description: 'Text to return.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return args.text
    },
  })
}
