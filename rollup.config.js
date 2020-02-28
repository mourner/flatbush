import resolve from '@rollup/plugin-node-resolve';
import buble from '@rollup/plugin-buble';
import {terser} from 'rollup-plugin-terser'

const output = (file, plugins) => ({
    input: 'index.js',
    output: {
        name: 'Flatbush',
        format: 'umd',
        indent: false,
        file
    },
    plugins
});

export default [
    output('flatbush.js', [resolve(), buble()]),
    output('flatbush.min.js', [resolve(), terser({compress: {passes: 2}}), buble()])
];
