import { describe, expect, it } from 'vitest';

import {
  REPORT_MARKER,
  ensureDirective,
  ensureNonDirective,
  reportPart,
} from '../src/error.js';
import { PartType } from '../src/types.js';
import { TextDirective } from './mocks.js';

describe('ensureDirective', () => {
  it('should throw an error if the value is not instance of the expected class', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    expect(() => ensureDirective(TextDirective, null, part)).toThrow(
      'A value must be a instance of TextDirective directive, but got "null".',
    );
  });

  it('should do nothing if the value is instance of the expected class', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    ensureDirective(TextDirective, new TextDirective(), part);
  });
});

describe('ensureNonDirective', () => {
  it('should throw an error if the value is any directive', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    expect(() => ensureNonDirective(new TextDirective(), part)).toThrow(
      'A value must not be a directive, but got "TextDirective".',
    );
  });

  it('should do nothing if the value is instance of the expected class', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    ensureNonDirective(null, part);
    ensureNonDirective(undefined, part);
    ensureNonDirective('foo', part);
    ensureNonDirective(123, part);
    ensureNonDirective(true, part);
    ensureNonDirective({}, part);
    ensureNonDirective(() => {}, part);
  });
});

describe('reportPart()', () => {
  it('should report where an AttributePart is inserted', () => {
    const part = {
      type: PartType.Attribute,
      name: 'class',
      node: document.createElement('div'),
    } as const;
    expect(reportPart(part)).toBe(`<div class=${REPORT_MARKER}></div>`);

    const container = document.createElement('div');
    container.appendChild(document.createTextNode('foo'));
    container.appendChild(part.node);
    container.appendChild(document.createComment('bar'));
    container.appendChild(document.createElement('span'));
    expect(reportPart(part)).toBe(
      `<div>foo<div class=${REPORT_MARKER}></div><!--bar--><span></span></div>`,
    );
  });

  it('should report where a ChildNodePart is inserted', () => {
    const part = {
      type: PartType.ChildNode,
      name: 'click',
      node: document.createComment(''),
    } as const;
    expect(reportPart(part)).toBe(`${REPORT_MARKER}<!---->`);

    const container = document.createElement('div');
    container.appendChild(document.createTextNode('foo'));
    container.appendChild(part.node);
    container.appendChild(document.createComment('bar'));
    container.appendChild(document.createElement('span'));
    expect(reportPart(part)).toBe(
      `<div>foo${REPORT_MARKER}<!----><!--bar--><span></span></div>`,
    );
  });

  it('should report where an ElementPart is inserted', () => {
    const part = {
      type: PartType.Element,
      node: document.createElement('div'),
    } as const;
    expect(reportPart(part)).toBe(`<div ${REPORT_MARKER}></div>`);

    const container = document.createElement('div');
    container.appendChild(document.createTextNode('foo'));
    container.appendChild(part.node);
    container.appendChild(document.createComment('bar'));
    container.appendChild(document.createElement('span'));
    expect(reportPart(part)).toBe(
      `<div>foo<div ${REPORT_MARKER}></div><!--bar--><span></span></div>`,
    );
  });

  it('should report where an EventPart is inserted', () => {
    const part = {
      type: PartType.Event,
      name: 'click',
      node: document.createElement('div'),
    } as const;
    expect(reportPart(part)).toBe(`<div @click=${REPORT_MARKER}></div>`);

    const container = document.createElement('div');
    container.appendChild(document.createTextNode('foo'));
    container.appendChild(part.node);
    container.appendChild(document.createComment('bar'));
    container.appendChild(document.createElement('span'));
    expect(reportPart(part)).toBe(
      `<div>foo<div @click=${REPORT_MARKER}></div><!--bar--><span></span></div>`,
    );
  });

  it('should report where a NodePart is inserted', () => {
    const part = {
      type: PartType.Node,
      name: 'click',
      node: document.createTextNode('foo'),
    } as const;
    expect(reportPart(part)).toBe(`${REPORT_MARKER}`);

    const container = document.createElement('div');
    container.appendChild(document.createTextNode('foo'));
    container.appendChild(part.node);
    container.appendChild(document.createComment('bar'));
    container.appendChild(document.createElement('span'));
    expect(reportPart(part)).toBe(
      `<div>foo${REPORT_MARKER}<!--bar--><span></span></div>`,
    );
  });

  it('should report where a PropertyPart is inserted', () => {
    const part = {
      type: PartType.Property,
      name: 'class',
      node: document.createElement('div'),
    } as const;
    expect(reportPart(part)).toBe(`<div .class=${REPORT_MARKER}></div>`);

    const container = document.createElement('div');
    container.appendChild(document.createTextNode('foo'));
    container.appendChild(part.node);
    container.appendChild(document.createComment('bar'));
    container.appendChild(document.createElement('span'));
    expect(reportPart(part)).toBe(
      `<div>foo<div .class=${REPORT_MARKER}></div><!--bar--><span></span></div>`,
    );
  });
});