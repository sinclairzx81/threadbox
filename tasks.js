/** Runs the example script in watch mode. */
export async function test() {
    console.log('started')
    await shell('tsc-bundle ./spec/tsconfig.json --outFile ./spec.js').exec()
    console.log('running')
    await shell('node spec').exec()
}

/** Runs the example script in watch mode. */
export async function watch() {
    await file('./spec.js').create().exec()
    await Promise.all([
        shell('tsc-bundle ./spec/tsconfig.json --watch --outFile ./spec.js').exec(),
        shell('smoke-run ./spec.js -x node spec').exec()
    ])
}

/** Builds the project documentation. */
export async function build_doc() {
    try {
        await folder('doc/typedoc').delete().exec()
        await shell('typedoc --out doc/typedoc --project src/tsconfig.json').exec()
    } catch(error) {
        console.log(`Unable to build documentation. Try '$ npm install typedoc -g' first.`)
        console.log(error.mesage)
    }
}

/** Builds redistributable in the 'dist' directory. */
export async function build() {
    await folder('dist').delete().exec()
    await shell('tsc --project ./src/tsconfig.json --outDir dist').exec()
    await folder('dist').add('license').exec()
    await folder('dist').add('package.json').exec()
    await folder('dist').add('readme.md').exec()
    await shell('cd dist && npm pack').exec()
}
