// 兼容规则只接受显式一对一映射；课程和旧派生标签不能转成掌握等级。
export type LegacyInput = {
    majorId: string;
    score?: number;
    plan?: unknown;
    subdirectionId?: string;
    courses?: string[];
    derivedTags?: string[];
};
export function migrateLegacy(value: LegacyInput, mappings: Record<string, string>) {
    const majors = ['cs', 'net', 'sec', 'data', 'se'];
    return { majorId: majors.includes(value.majorId) ? value.majorId : null, topicId: value.subdirectionId ? mappings[value.subdirectionId] ?? null : null, needsConfirmation: !!value.subdirectionId && !mappings[value.subdirectionId], knowledge: {}, legacySnapshot: structuredClone(value) };
}
