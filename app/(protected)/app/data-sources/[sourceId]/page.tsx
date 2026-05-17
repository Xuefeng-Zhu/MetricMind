import { DataSourceDetailPage } from "@/components/data-sources/data-source-detail-page";
import { getDataSourcesPageData } from "@/lib/data-sources/service";
import {
  createSemanticModelFromDatasetAction,
  syncDataSourceAction,
} from "../actions";

interface DataSourceRouteProps {
  params: {
    sourceId: string;
  };
}

export default async function DataSourceRoute({
  params,
}: DataSourceRouteProps) {
  const initialData = await getDataSourcesPageData();

  return (
    <DataSourceDetailPage
      initialData={initialData}
      sourceId={params.sourceId}
      syncDataSourceAction={syncDataSourceAction}
      createSemanticModelFromDatasetAction={createSemanticModelFromDatasetAction}
    />
  );
}
