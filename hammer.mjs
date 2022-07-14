/** Runs the example script in watch mode. */
export async function test() {
    await shell('tsc-bundle ./spec/tsconfig.json --outFile ./spec.js')
    await shell('node spec').exec()
}

/** Runs the example script in watch mode. */
export async function example() {
    await shell('hammer run example/index.ts --dist target/example')
}

/** Builds redistributable in the 'dist' directory. */
export async function build() {
    await folder('target/build').delete()
    await shell('tsc -p ./src/tsconfig.json --outDir dist')
    await folder('target/build').add('license')
    await folder('target/build').add('package.json')
    await folder('target/build').add('readme.md')
    await shell('cd target/build && npm pack')
}
