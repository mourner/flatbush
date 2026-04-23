import mourner from 'eslint-config-mourner';
import e18e from '@e18e/eslint-plugin';

export default [
	...mourner,
	e18e.configs.recommended
];
