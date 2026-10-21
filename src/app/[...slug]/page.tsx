import { Workspace } from '@/components/workspace';
export default async function Page({ params }: {
    params: Promise<{
        slug: string[];
    }>;
}) { const { slug } = await params; return <Workspace slug={slug}/>; }
