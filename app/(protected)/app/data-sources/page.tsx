import { DataSourcesPage } from "@/components/data-sources/data-sources-page";
import { getDataSourcesPageData } from "@/lib/data-sources/service";
import {
  createDemoDataSourceAction,
  createSemanticModelFromDatasetAction,
  syncDataSourceAction,
} from "./actions";

export default async function DataSourcesRoute() {
  const initialData = await getDataSourcesPageData();

  return (
    <DataSourcesPage
      initialData={initialData}
      createDemoDataSourceAction={createDemoDataSourceAction}
      syncDataSourceAction={syncDataSourceAction}
      createSemanticModelFromDatasetAction={createSemanticModelFromDatasetAction}
    />
  );
}
