import buble from 'rollup-plugin-buble';
import uglify from 'rollup-plugin-uglify'

const output = (file, plugins) => ({
    input: 'index.js',
    output: {
        name: 'Flatbush',
        format: 'umd',
        file
    },
    plugins
});

export default [
    output('flatbush.js', [buble()]),
    output('flatbush.min.js', [uglify(), buble()])
];
