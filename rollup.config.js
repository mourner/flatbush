import buble from 'rollup-plugin-buble';
import {terser} from 'rollup-plugin-terser'

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
    output('flatbush.min.js', [terser(), buble()])
];
